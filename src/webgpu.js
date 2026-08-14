const shader = /* wgsl */ `
struct Params {
  width: u32,
  height: u32,
  radius: u32,
  horizontal: u32,
  sigma: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}
@group(0) @binding(0) var<storage, read> source: array<f32>;
@group(0) @binding(1) var<storage, read_write> destination: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  let total = params.width * params.height;
  if (index >= total) { return; }
  let x = i32(index % params.width);
  let y = i32(index / params.width);
  let width = i32(params.width);
  let height = i32(params.height);
  let radius = i32(params.radius);
  let sigma2 = 2.0 * params.sigma * params.sigma;
  var sum = 0.0;
  var weightSum = 0.0;
  for (var offset = -radius; offset <= radius; offset = offset + 1) {
    var sx = x;
    var sy = y;
    if (params.horizontal == 1u) { sx = clamp(x + offset, 0, width - 1); }
    else { sy = clamp(y + offset, 0, height - 1); }
    let weight = exp(-f32(offset * offset) / sigma2);
    sum += source[u32(sy * width + sx)] * weight;
    weightSum += weight;
  }
  destination[index] = sum / weightSum;
}
`;

export class WebGpuGaussian {
  static async create(width, height, locale = "en") {
    const message = (english, chinese) => locale === "zh" ? chinese : english;
    if (!globalThis.navigator?.gpu) throw new Error(message("This browser does not provide WebGPU", "此浏览器未提供 WebGPU"));
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error(message("No WebGPU adapter is available", "没有可用的 WebGPU 适配器"));
    const tileBytes = Math.min(width * height, 1_500_000) * 4;
    if (tileBytes > adapter.limits.maxStorageBufferBindingSize) throw new Error(message("The current WebGPU buffer limit is too low", "当前 WebGPU 缓冲区限制过低"));
    const device = await adapter.requestDevice();
    const engine = await WebGpuGaussian.createForDevice(device, width, height, locale);
    const probe = new Float32Array(16).fill(1);
    const checked = await engine.runPass(probe, 4, 4, 0.65, true);
    if (!checked.every((value) => Number.isFinite(value) && value > 0.9)) {
      engine.destroy();
      throw new Error(message("WebGPU self-test returned an invalid result", "WebGPU 自检结果异常"));
    }
    return engine;
  }

  static async createForDevice(device, width, height, locale = "en") {
    const module = device.createShaderModule({ label: "Gaussian blur shader", code: shader });
    const compilation = await module.getCompilationInfo();
    const errors = compilation.messages.filter((message) => message.type === "error");
    if (errors.length) {
      device.destroy();
      throw new Error(errors.map((message) => `WGSL ${message.lineNum}:${message.linePos} ${message.message}`).join(" | "));
    }
    device.pushErrorScope("validation");
    let pipeline;
    try {
      pipeline = await device.createComputePipelineAsync({
        label: "Gaussian blur pipeline",
        layout: "auto",
        compute: { module, entryPoint: "main" },
      });
      const validation = await device.popErrorScope();
      if (validation) throw validation;
    } catch (error) {
      try { await device.popErrorScope(); } catch {}
      device.destroy();
      const prefix = locale === "zh" ? "WebGPU 管线创建失败：" : "WebGPU pipeline creation failed: ";
      throw new Error(`${prefix}${error?.message || error}`);
    }
    return new WebGpuGaussian(device, width, height, pipeline);
  }

  constructor(device, width, height, pipeline) {
    this.device = device;
    this.width = width;
    this.height = height;
    this.tilePixels = 1_500_000;
    this.pipeline = pipeline;
  }

  async runTile(input, tileWidth, tileHeight, sigma, horizontal) {
    const byteLength = input.byteLength;
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const source = this.device.createBuffer({ size: byteLength, usage });
    const target = this.device.createBuffer({ size: byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const uniform = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const readback = this.device.createBuffer({ size: byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const raw = new ArrayBuffer(32);
      const u32 = new Uint32Array(raw);
      const f32 = new Float32Array(raw);
      u32[0] = tileWidth;
      u32[1] = tileHeight;
      u32[2] = Math.max(1, Math.ceil(sigma * 4));
      u32[3] = horizontal ? 1 : 0;
      f32[4] = sigma;
      this.device.queue.writeBuffer(source, 0, input);
      this.device.queue.writeBuffer(uniform, 0, raw);
      const bind = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: source } },
          { binding: 1, resource: { buffer: target } },
          { binding: 2, resource: { buffer: uniform } },
        ],
      });
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(Math.ceil(input.length / 256));
      pass.end();
      encoder.copyBufferToBuffer(target, 0, readback, 0, byteLength);
      this.device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      return new Float32Array(readback.getMappedRange()).slice();
    } finally {
      if (readback.mapState === "mapped") readback.unmap();
      source.destroy();
      target.destroy();
      uniform.destroy();
      readback.destroy();
    }
  }

  async runPass(input, tileWidth, tileHeight, sigma, horizontal) {
    let scoped = false;
    try {
      if (this.device.pushErrorScope) {
        this.device.pushErrorScope("validation");
        scoped = true;
      }
      const result = await this.runTile(input, tileWidth, tileHeight, sigma, horizontal);
      const error = scoped ? await this.device.popErrorScope() : null;
      scoped = false;
      if (error) throw new Error(error.message);
      return result;
    } catch (error) {
      try { if (scoped && this.device.popErrorScope) await this.device.popErrorScope(); } catch {}
      throw error;
    }
  }

  async blur(input, sigma) {
    if (sigma <= 0) return input.slice();
    const radius = Math.max(1, Math.ceil(sigma * 4));
    const rowsPerTile = Math.max(1, Math.floor(this.tilePixels / this.width));
    const horizontal = new Float32Array(input.length);
    for (let startY = 0; startY < this.height; startY += rowsPerTile) {
      const rows = Math.min(rowsPerTile, this.height - startY);
      const start = startY * this.width;
      const tile = input.slice(start, start + rows * this.width);
      horizontal.set(await this.runPass(tile, this.width, rows, sigma, true), start);
    }

    const output = new Float32Array(input.length);
    for (let outputY = 0; outputY < this.height; outputY += rowsPerTile) {
      const outputRows = Math.min(rowsPerTile, this.height - outputY);
      const sourceY = Math.max(0, outputY - radius);
      const sourceEndY = Math.min(this.height, outputY + outputRows + radius);
      const tileRows = sourceEndY - sourceY;
      const tile = horizontal.slice(sourceY * this.width, sourceEndY * this.width);
      const filtered = await this.runPass(tile, this.width, tileRows, sigma, false);
      const cropY = outputY - sourceY;
      output.set(filtered.subarray(cropY * this.width, (cropY + outputRows) * this.width), outputY * this.width);
    }
    return output;
  }

  destroy() { this.device.destroy(); }
}

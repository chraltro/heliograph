/** Thin WebGL2 helpers: compile, link, report failures with the offending source. */

export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('could not create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error'
    const numbered = source
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(3)} | ${line}`)
      .join('\n')
    gl.deleteShader(shader)
    throw new Error(`shader failed to compile: ${log}\n${numbered}`)
  }
  return shader
}

export function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('could not create program')
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown error'
    gl.deleteProgram(program)
    throw new Error(`program failed to link: ${log}`)
  }
  return program
}

/** Uniform locations resolved once and looked up by name afterwards. */
export class Uniforms {
  private readonly locations = new Map<string, WebGLUniformLocation | null>()

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly program: WebGLProgram,
  ) {}

  private at(name: string): WebGLUniformLocation | null {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name))
    }
    return this.locations.get(name) ?? null
  }

  f1(name: string, value: number): void {
    const l = this.at(name)
    if (l) this.gl.uniform1f(l, value)
  }

  i1(name: string, value: number): void {
    const l = this.at(name)
    if (l) this.gl.uniform1i(l, value)
  }

  f2(name: string, x: number, y: number): void {
    const l = this.at(name)
    if (l) this.gl.uniform2f(l, x, y)
  }

  f3(name: string, x: number, y: number, z: number): void {
    const l = this.at(name)
    if (l) this.gl.uniform3f(l, x, y, z)
  }

  f4(name: string, x: number, y: number, z: number, w: number): void {
    const l = this.at(name)
    if (l) this.gl.uniform4f(l, x, y, z, w)
  }

  fv(name: string, values: Float32Array): void {
    const l = this.at(name)
    if (l) this.gl.uniform1fv(l, values)
  }

  f3v(name: string, values: Float32Array): void {
    const l = this.at(name)
    if (l) this.gl.uniform3fv(l, values)
  }
}

export function createBuffer(
  gl: WebGL2RenderingContext,
  // Deliberately loose: typed arrays built from a manifest carry an
  // ArrayBufferLike, which the narrower BufferSource alias rejects.
  data: ArrayBufferView,
  target: number = gl.ARRAY_BUFFER,
): WebGLBuffer {
  const buffer = gl.createBuffer()
  if (!buffer) throw new Error('could not create buffer')
  gl.bindBuffer(target, buffer)
  gl.bufferData(target, data as unknown as BufferSource, gl.STATIC_DRAW)
  gl.bindBuffer(target, null)
  return buffer
}

export interface AttributeSpec {
  buffer: WebGLBuffer
  size: number
  type?: number
  stride?: number
  offset?: number
  divisor?: number
  normalized?: boolean
}

/**
 * Build a vertex array object. Attribute locations come from the program so the
 * shaders stay readable without explicit layout qualifiers everywhere.
 */
export function createVao(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  attributes: Record<string, AttributeSpec>,
  indices?: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()
  if (!vao) throw new Error('could not create vertex array')
  gl.bindVertexArray(vao)
  for (const [name, spec] of Object.entries(attributes)) {
    const location = gl.getAttribLocation(program, name)
    if (location < 0) continue
    gl.bindBuffer(gl.ARRAY_BUFFER, spec.buffer)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(
      location,
      spec.size,
      spec.type ?? gl.FLOAT,
      spec.normalized ?? false,
      spec.stride ?? 0,
      spec.offset ?? 0,
    )
    if (spec.divisor) gl.vertexAttribDivisor(location, spec.divisor)
  }
  if (indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  return vao
}

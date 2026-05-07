(() => {
  // assets/webgl/WaterGradientLayer.js
  var WaterGradientLayer = class {
    constructor(gl) {
      this.gl = gl;
      this.program = null;
      this.buffers = {};
      const paletteHex = [
        "#000011",
        // 0 - deepest black-blue
        "#000a28",
        // 1 - very dark blue
        "#00395f",
        // 2 - dark blue
        "#0e4462",
        // 3 - dark ocean blue
        "#155d80",
        // 4 - medium dark blue
        "#1f7da5",
        // 5 - medium blue
        "#3ca4c5",
        // 6 - bright blue
        "#8ed2e8",
        // 7 - light blue
        "#c7e9f4",
        // 8 - very light blue
        "#ffffff"
        // 9 - white
      ];
      const hexToRgb = (hex) => {
        const h = hex.replace("#", "");
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        return [r, g, b];
      };
      const paletteRgb = paletteHex.map(hexToRgb);
      const getColor = (index, alpha) => {
        const rgb = paletteRgb[index];
        return [rgb[0], rgb[1], rgb[2], alpha];
      };
      const surfaceColor = getColor(6, 1);
      const depthColor = getColor(1, 1);
      this.gradient = {
        topColor: depthColor,
        // Dark at top of screen
        bottomColor: surfaceColor
        // Light at bottom (surface)
      };
    }
    init(width, height) {
      this.width = width;
      this.height = height;
      this.compileShaders();
      this.createBuffers();
    }
    compileShaders() {
      const gl = this.gl;
      const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_uv;
            
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
      const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_uv;
            out vec4 outColor;
            
            uniform vec4 u_topColor;
            uniform vec4 u_bottomColor;
            uniform float u_time;
            
            float random(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            // Underwater caustics: two families of ridged sine waves interfering.
            // Creates the characteristic bright-network pattern of refracted surface light.
            float caustics(vec2 uv, float t) {
                // Aspect-correct: compress Y so patterns aren't too elongated
                vec2 p = uv * vec2(5.5, 3.5);

                // Family A \u2014 drifting diagonally
                float a1 = abs(sin(p.x * 1.10 + sin(p.y * 0.85 + t * 0.06) * 1.30 + t * 0.04));
                float a2 = abs(sin(p.y * 0.95 + sin(p.x * 1.20 - t * 0.05) * 1.15 - t * 0.03));

                // Family B \u2014 slower, wider, perpendicular bias
                float b1 = abs(sin(p.x * 0.70 - sin(p.y * 1.30 + t * 0.04) * 0.90 + t * 0.025));
                float b2 = abs(sin(p.y * 0.80 + sin(p.x * 0.65 - t * 0.03) * 1.05 - t * 0.02));

                // Ridged = 1 - abs(sin(...)), gives bright lines at wave crests
                float netA = (1.0 - a1) * (1.0 - a2);   // bright nodes where A waves meet
                float netB = (1.0 - b1) * (1.0 - b2);

                // Blend both families
                float pattern = max(netA, netB * 0.7);

                // Sharpen: only the brightest intersections are caustic hotspots
                return pow(pattern, 2.8);
            }
            
            void main() {
                // Base gradient
                float t = pow(v_uv.y, 1.6);
                vec4 baseColor = mix(u_topColor, u_bottomColor, t);

                // Caustics \u2014 visible only in upper portion (near surface), fade to zero at depth.
                // Early-exit skips the expensive caustics call for deeply-submerged pixels
                // where the contribution (0.13 * surfaceFade * c) would be below ~1/255.
                float surfaceFade = smoothstep(0.0, 0.65, v_uv.y); // 0 at bottom, 1 near top
                if (surfaceFade > 0.05) {
                    float c = caustics(v_uv, u_time);
                    vec3 causticColor = vec3(0.55, 0.88, 1.0);
                    baseColor.rgb += causticColor * c * 0.13 * surfaceFade;
                }
            
                // Dithering to kill banding
                float grain = random(gl_FragCoord.xy) * 0.015;
                baseColor.rgb += grain;

                // Vin\u011Bta \u2014 tmav\xE9 okraje, eliptick\xE1 (\u0161ir\u0161\xED horizont\xE1ln\u011B)
                vec2 vCenter = v_uv - vec2(0.5, 0.5);
                vCenter.x *= 0.75; // elipsa: m\xE9n\u011B agresivn\xED na \u0161\xED\u0159i
                float vDist = length(vCenter) * 1.55;
                float vignette = 1.0 - smoothstep(0.45, 1.05, vDist);
                baseColor.rgb *= vignette;

                outColor = baseColor;
            }
        `;
      this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      if (this.program) {
        const gl2 = this.gl;
        const p = this.program;
        this.locs = {
          time: gl2.getUniformLocation(p, "u_time"),
          topColor: gl2.getUniformLocation(p, "u_topColor"),
          bottomColor: gl2.getUniformLocation(p, "u_bottomColor"),
          position: gl2.getAttribLocation(p, "a_position")
        };
      }
    }
    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        return null;
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error:", gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        return null;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return program;
    }
    createBuffers() {
      const gl = this.gl;
      const positions = new Float32Array([
        -1,
        -1,
        1,
        -1,
        -1,
        1,
        1,
        1
      ]);
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      this.buffers.position = positionBuffer;
    }
    render(currentTime, deltaTime) {
      const gl = this.gl;
      const program = this.program;
      if (!program) return;
      gl.useProgram(program);
      const locs = this.locs;
      if (locs.time) gl.uniform1f(locs.time, currentTime * 1e-3);
      if (locs.topColor) gl.uniform4fv(locs.topColor, this.gradient.topColor);
      if (locs.bottomColor) gl.uniform4fv(locs.bottomColor, this.gradient.bottomColor);
      gl.enableVertexAttribArray(locs.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
      gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
    }
    destroy() {
      const gl = this.gl;
      if (this.program) gl.deleteProgram(this.program);
      if (this.buffers.position) gl.deleteBuffer(this.buffers.position);
    }
    toggle(enabled) {
      this.enabled = !!enabled;
      if (this.enabled && !this.program) {
        if (this.width && this.height) {
          this.init(this.width, this.height);
        }
      }
    }
  };

  // assets/webgl/LightRaysLayer.js
  var LightRaysLayer = class {
    constructor(gl, options = {}) {
      this.gl = gl;
      this.program = null;
      this.buffers = {};
      this.rays = [];
      this.options = { rayCount: 5, ...options };
      this.rayBeamsEnabled = true;
      this.sunGlowEnabled = true;
      this._raysArr = new Float32Array(5);
      this._swaysArr = new Float32Array(5);
      this._shimmersArr = new Float32Array(5);
    }
    init(width, height) {
      this.width = width;
      this.height = height;
      this.initRays(width);
      this.compileShaders();
      this.createBuffers();
    }
    initRays(width) {
      this.rays = [];
      const rayCount = this.options.rayCount;
      const spacing = width / (rayCount + 1);
      for (let i = 0; i < rayCount; i++) {
        this.rays.push({
          x: spacing * (i + 1),
          offset: Math.random() * Math.PI * 2,
          speed: 0.8 + Math.random() * 0.4,
          // Two independent shimmer frequencies per ray — keeps them visually distinct
          shimFreqA: 18e-5 + Math.random() * 22e-5,
          shimPhaseA: Math.random() * Math.PI * 2,
          shimFreqB: 31e-5 + Math.random() * 19e-5,
          shimPhaseB: Math.random() * Math.PI * 2
        });
      }
    }
    compileShaders() {
      const gl = this.gl;
      const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_uv;
            
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
      const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_uv;
            out vec4 outColor;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_rays[5];   // x positions
            uniform float u_sways[5];  // sway amounts
            uniform float u_shimmers[5]; // per-ray shimmer multipliers
            uniform int u_rayCount;
            uniform int u_rayBeamsEnabled;
            uniform int u_sunGlowEnabled;
            
            float rayIntensity(float x, float rayX, float sway) {
                float topX = rayX + sway * v_uv.y;
                float dist = abs(x - topX);
                float rayWidth = 40.0;
                float intensity = 1.0 - smoothstep(0.0, rayWidth / 2.0, dist);
                return intensity;
            }
            
            void main() {
                float x = v_uv.x * u_resolution.x;
                float y = v_uv.y;
                
                vec4 color = vec4(0.0);
                vec3 warmLight = vec3(1.0, 1.0, 0.863);  // Tepl\xE9 sv\u011Btlo pro rays
                vec3 coolLight = vec3(0.122, 0.490, 0.647); // St\u0159edn\xED modr\xE1 z palety (#1f7da5) pro glow
                
                // Ray beams (ku\u017Eely)
                if (u_rayBeamsEnabled == 1) {
                    float totalIntensity = 0.0;
                    for (int i = 0; i < u_rayCount; i++) {
                        totalIntensity += rayIntensity(x, u_rays[i], u_sways[i]) * u_shimmers[i];
                    }
                    
                    float verticalFade = y; // Siln\u011Bj\u0161\xED naho\u0159e (y=1), slab\u0161\xED dole (y=0)
                    float rayAlpha = totalIntensity * 0.08 * verticalFade;
                    color.rgb += warmLight * rayAlpha;
                    color.a += rayAlpha;
                }
                
                // Sun glow (radi\xE1ln\xED z\xE1\u0159e)
                if (u_sunGlowEnabled == 1) {
                    vec2 center = vec2(0.5, 1.0);
                    vec2 diff = v_uv - center;
                    float dist = length(diff);
                    
                    // Siln\u011Bj\u0161\xED pulsov\xE1n\xED
                    float pulse = 0.75 + sin(u_time * 0.0005) * 0.25;
                    
                    // Hlad\u0161\xED gradient s v\xEDce kroky pro odstran\u011Bn\xED pruh\u016F
                    float glowRadius = 0.9;
                    float glow = smoothstep(glowRadius, 0.0, dist);
                    glow = smoothstep(0.0, 1.0, glow); // Dvojit\xE9 smoothstep pro extra vyhlazen\xED
                    glow = pow(glow, 1.8);
                    
                    // Vertik\xE1ln\xED fade
                    float verticalFade = smoothstep(0.0, 0.7, y);
                    
                    // Prol\xEDn\xE1n\xED
                    float glowStrength = glow * pulse * verticalFade;
                    color.rgb += coolLight * glowStrength * 0.6;
                    color.a += glowStrength * 0.4;
                }
                
                outColor = color;
            }
        `;
      this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      if (this.program) {
        const gl2 = this.gl;
        const p = this.program;
        this.locs = {
          resolution: gl2.getUniformLocation(p, "u_resolution"),
          time: gl2.getUniformLocation(p, "u_time"),
          rayCount: gl2.getUniformLocation(p, "u_rayCount"),
          rayBeamsEnabled: gl2.getUniformLocation(p, "u_rayBeamsEnabled"),
          sunGlowEnabled: gl2.getUniformLocation(p, "u_sunGlowEnabled"),
          position: gl2.getAttribLocation(p, "a_position"),
          // Array uniforms: get location of first element, upload all with uniform1fv
          rays: gl2.getUniformLocation(p, "u_rays[0]"),
          sways: gl2.getUniformLocation(p, "u_sways[0]"),
          shimmers: gl2.getUniformLocation(p, "u_shimmers[0]")
        };
      }
    }
    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
        return null;
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error:", gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return program;
    }
    createBuffers() {
      const gl = this.gl;
      const positions = new Float32Array([
        -1,
        -1,
        1,
        -1,
        -1,
        1,
        1,
        1
      ]);
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      this.buffers.position = positionBuffer;
    }
    render(currentTime, deltaTime) {
      const gl = this.gl;
      const program = this.program;
      if (!program) return;
      gl.useProgram(program);
      const locs = this.locs;
      gl.uniform2f(locs.resolution, this.width, this.height);
      gl.uniform1f(locs.time, currentTime);
      gl.uniform1i(locs.rayCount, this.rays.length);
      gl.uniform1i(locs.rayBeamsEnabled, this.rayBeamsEnabled ? 1 : 0);
      gl.uniform1i(locs.sunGlowEnabled, this.sunGlowEnabled ? 1 : 0);
      const raySpeed = 5e-5;
      for (let i = 0; i < this.rays.length; i++) {
        const ray = this.rays[i];
        this._raysArr[i] = ray.x;
        this._swaysArr[i] = Math.sin(currentTime * raySpeed * ray.speed + ray.offset) * 30;
        this._shimmersArr[i] = 0.55 + 0.45 * 0.5 * ((1 + Math.sin(currentTime * ray.shimFreqA + ray.shimPhaseA)) * (1 + Math.sin(currentTime * ray.shimFreqB + ray.shimPhaseB)) / 4);
      }
      gl.uniform1fv(locs.rays, this._raysArr);
      gl.uniform1fv(locs.sways, this._swaysArr);
      gl.uniform1fv(locs.shimmers, this._shimmersArr);
      gl.enableVertexAttribArray(locs.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
      gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
      this.initRays(width);
    }
    destroy() {
      const gl = this.gl;
      if (this.program) gl.deleteProgram(this.program);
      if (this.buffers.position) gl.deleteBuffer(this.buffers.position);
    }
    toggle(enabled) {
      this.enabled = !!enabled;
      if (this.enabled && !this.program) {
        if (this.width && this.height) {
          this.init(this.width, this.height);
        }
      }
    }
  };

  // assets/webgl/BubblesLayer.js
  var BubblesLayer = class {
    constructor(gl, config = {}) {
      this.gl = gl;
      this.program = null;
      this.buffers = {};
      this.bubbles = [];
      this.sources = [];
      this.qualityMultiplier = 1;
      this.config = {
        sourceWidthBase: 400,
        minSourceSpacing: 80,
        minSize: 4,
        maxSize: 10,
        riseSpeed: 0.3,
        swayAmount: 10,
        bubblesPerSource: 0.02,
        ...config
      };
    }
    init(width, height) {
      this.width = width;
      this.height = height;
      this.initSources(width, height);
      this.compileShaders();
      this.createBuffers();
    }
    initSources(width, height) {
      this.sources = [];
      const baseSourceCount = Math.max(1, Math.floor(width / this.config.sourceWidthBase));
      const targetSourceCount = Math.max(1, baseSourceCount);
      for (let attempt = 0; attempt < targetSourceCount * 10 && this.sources.length < targetSourceCount; attempt++) {
        const x = Math.random() * width;
        let tooClose = false;
        for (const source of this.sources) {
          if (Math.abs(source.x - x) < this.config.minSourceSpacing) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          this.sources.push({ x, y: height + 5 });
        }
      }
    }
    compileShaders() {
      const gl = this.gl;
      const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in float a_size;
            in float a_age;
            in float a_swayPeriod;
            in float a_startX;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_swayAmount;
            
            out float v_age;
            out float v_size;
            
            void main() {
                float swayProgress = mod(a_age / a_swayPeriod, 1.0);
                float swayOffset = sin(swayProgress * 6.28318530718) * u_swayAmount;
                
                vec2 position = a_position;
                position.x = a_startX + swayOffset;
                
                vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_size;
                
                v_age = a_age;
                v_size = a_size;
            }
        `;
      const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in float v_age;
            in float v_size;
            
            out vec4 outColor;
            
            void main() {
                vec2 coord = gl_PointCoord - 0.5;
                float dist = length(coord);
                
                if (dist > 0.5) discard;
                
                float gradient = 1.0 - dist * 2.0;
                vec3 color = mix(vec3(0.588, 0.784, 1.0), vec3(1.0), gradient);
                float alpha = gradient * 0.6;
                
                outColor = vec4(color, alpha);
            }
        `;
      this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      if (this.program) {
        const gl2 = this.gl;
        const p = this.program;
        this.locs = {
          resolution: gl2.getUniformLocation(p, "u_resolution"),
          swayAmount: gl2.getUniformLocation(p, "u_swayAmount"),
          position: gl2.getAttribLocation(p, "a_position"),
          size: gl2.getAttribLocation(p, "a_size"),
          age: gl2.getAttribLocation(p, "a_age"),
          swayPeriod: gl2.getAttribLocation(p, "a_swayPeriod"),
          startX: gl2.getAttribLocation(p, "a_startX")
        };
      }
    }
    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
        return null;
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error:", gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return program;
    }
    createBuffers() {
      const gl = this.gl;
      this.MAX_BUBBLES = 200;
      const maxN = this.MAX_BUBBLES;
      this._cpu = {
        positions: new Float32Array(maxN * 2),
        sizes: new Float32Array(maxN),
        ages: new Float32Array(maxN),
        swayPeriods: new Float32Array(maxN),
        startXs: new Float32Array(maxN)
      };
      const allocGPU = (byteSize) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, byteSize, gl.DYNAMIC_DRAW);
        return buf;
      };
      this.buffers.position = allocGPU(maxN * 2 * 4);
      this.buffers.size = allocGPU(maxN * 4);
      this.buffers.age = allocGPU(maxN * 4);
      this.buffers.swayPeriod = allocGPU(maxN * 4);
      this.buffers.startX = allocGPU(maxN * 4);
      const locs = this.locs;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const setupVertexAttribute = (loc, buf, size) => {
        if (loc < 0) return;
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      setupVertexAttribute(locs.position, this.buffers.position, 2);
      setupVertexAttribute(locs.size, this.buffers.size, 1);
      setupVertexAttribute(locs.age, this.buffers.age, 1);
      setupVertexAttribute(locs.swayPeriod, this.buffers.swayPeriod, 1);
      setupVertexAttribute(locs.startX, this.buffers.startX, 1);
      gl.bindVertexArray(null);
    }
    render(currentTime, deltaTime) {
      const gl = this.gl;
      const program = this.program;
      if (!program) return;
      const spawnChance = this.config.bubblesPerSource * this.qualityMultiplier;
      for (const source of this.sources) {
        if (Math.random() < spawnChance) {
          this.spawnBubble(source);
        }
      }
      const dt = Math.min(deltaTime, 50);
      let bWrite = 0;
      for (let bi = 0; bi < this.bubbles.length; bi++) {
        const bubble = this.bubbles[bi];
        bubble.y -= bubble.riseSpeed * this.config.riseSpeed;
        bubble.age += dt;
        const riseProgress = 1 - bubble.y / this.height;
        bubble.size = bubble.baseSize * (1 - riseProgress * 0.6);
        if (bubble.y + bubble.size >= 0) {
          this.bubbles[bWrite++] = bubble;
        }
      }
      this.bubbles.length = bWrite;
      const n = Math.min(this.bubbles.length, this.MAX_BUBBLES);
      if (n === 0) return;
      const cpu = this._cpu;
      for (let i = 0; i < n; i++) {
        const b = this.bubbles[i];
        cpu.positions[i * 2] = b.startX;
        cpu.positions[i * 2 + 1] = b.y;
        cpu.sizes[i] = b.size;
        cpu.ages[i] = b.age;
        cpu.swayPeriods[i] = b.swayPeriod;
        cpu.startXs[i] = b.startX;
      }
      gl.useProgram(program);
      const locs = this.locs;
      gl.uniform2f(locs.resolution, this.width, this.height);
      gl.uniform1f(locs.swayAmount, this.config.swayAmount);
      const sub = (buf, data, count, stride) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * stride));
      };
      sub(this.buffers.position, cpu.positions, n, 2);
      sub(this.buffers.size, cpu.sizes, n, 1);
      sub(this.buffers.age, cpu.ages, n, 1);
      sub(this.buffers.swayPeriod, cpu.swayPeriods, n, 1);
      sub(this.buffers.startX, cpu.startXs, n, 1);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.bindVertexArray(null);
    }
    spawnBubble(source) {
      const baseSize = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
      const offsetX = (Math.random() - 0.5) * 20;
      this.bubbles.push({
        startX: source.x + offsetX,
        y: source.y,
        baseSize,
        size: baseSize,
        riseSpeed: 0.5 + Math.random() * 1.5,
        swayPeriod: 2e3 + Math.random() * 3e3,
        age: Math.random() * 1e3
      });
    }
    setQuality(quality) {
      this.qualityMultiplier = quality;
    }
    toggle(enabled) {
      this.enabled = !!enabled;
      if (this.enabled && !this.program) {
        if (this.width && this.height) {
          this.init(this.width, this.height);
        }
      }
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
      this.initSources(width, height);
    }
    destroy() {
      const gl = this.gl;
      if (this.program) gl.deleteProgram(this.program);
      if (this.vao) gl.deleteVertexArray(this.vao);
      for (const key in this.buffers) {
        gl.deleteBuffer(this.buffers[key]);
      }
    }
  };

  // assets/webgl/PlanktonLayer.js
  var PlanktonLayer = class {
    constructor(gl, config = {}) {
      this.gl = gl;
      this.program = null;
      this.microProgram = null;
      this.buffers = {};
      this.microBuffers = {};
      this.particles = [];
      this.microParticles = [];
      this.qualityMultiplier = 1;
      this._lastOpacity = null;
      this.config = {
        swarmCount: 30,
        particlesPerSwarm: 50,
        fineCount: 1500,
        microCount: 500,
        ...config
      };
    }
    init(width, height) {
      this.width = width;
      this.height = height;
      this.initParticles(width, height);
      this.initMicroParticles();
      this.compileShaders();
      this.compileMicroShaders();
      this.createBuffers();
      this.createMicroBuffers();
    }
    initParticles(width, height) {
      this.particles = [];
      for (let s = 0; s < this.config.swarmCount; s++) {
        const centerX = Math.random();
        const centerY = Math.pow(Math.random(), 2) * 0.7 + 0.05;
        const swarmSpreadX = 0.02 + Math.random() * 0.03;
        const swarmSpreadY = 0.015 + Math.random() * 0.02;
        for (let i = 0; i < this.config.particlesPerSwarm; i++) {
          const spreadX = (Math.random() - 0.5) * swarmSpreadX;
          const spreadY = (Math.random() - 0.5) * swarmSpreadY;
          const yPos = Math.min(0.9, Math.max(0.05, centerY + spreadY));
          this.particles.push({
            x: Math.min(1, Math.max(0, centerX + spreadX)),
            y: yPos,
            size: Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3,
            driftX: Math.random() * 16 - 8,
            duration: Math.random() * 12 + 4,
            phase: Math.random() * Math.PI * 2,
            opacity: 0.25 + Math.random() * 0.45,
            green: 170 + Math.floor(Math.random() * 85),
            glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
            glimmerOffset: Math.random() * Math.PI * 2,
            glimmerSpeed: 0.4 + Math.random() * 0.8
          });
        }
      }
      for (let i = 0; i < this.config.fineCount; i++) {
        const yPos = Math.pow(Math.random(), 2) * 0.9 + 0.05;
        this.particles.push({
          x: Math.random(),
          y: yPos,
          size: Math.random() < 0.9 ? 1 : 2,
          driftX: Math.random() * 18 - 9,
          duration: 6 + Math.random() * 28,
          phase: Math.random() * Math.PI * 2,
          opacity: 0.05 + Math.random() * 0.2,
          green: 170 + Math.floor(Math.random() * 70),
          glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
          glimmerOffset: Math.random() * Math.PI * 2,
          glimmerSpeed: 0.4 + Math.random() * 0.8
        });
      }
    }
    initMicroParticles() {
      this.microParticles = [];
      for (let i = 0; i < this.config.microCount; i++) {
        this.microParticles.push({
          x: Math.random(),
          baseY: Math.random(),
          // 0–1, startovní výška
          speed: 3 + Math.random() * 8,
          // px/s stoupání
          phase: Math.random() * Math.PI * 2,
          opacity: 0.06 + Math.random() * 0.12
        });
      }
    }
    compileMicroShaders() {
      const vertSrc = `#version 300 es
            in float a_x;
            in float a_baseY;
            in float a_speed;
            in float a_phase;

            uniform vec2 u_resolution;
            uniform float u_time;

            out float v_fade;

            void main() {
                // Stoup\xE1n\xED nahoru s wrapem
                float yPx = a_baseY * u_resolution.y;
                float risen = mod(u_time * a_speed * 0.001, u_resolution.y);
                float y = mod(yPx - risen + u_resolution.y, u_resolution.y);

                // Jemn\xE9 vodorovn\xE9 vln\u011Bn\xED
                float x = a_x * u_resolution.x + sin(u_time * 0.0004 * a_speed + a_phase) * 6.0;

                // Fade u vrcholu a dna
                float normY = y / u_resolution.y;
                v_fade = smoothstep(0.0, 0.07, normY) * smoothstep(1.0, 0.88, normY);

                vec2 clip = (vec2(x, y) / u_resolution) * 2.0 - 1.0;
                clip.y = -clip.y;
                gl_Position = vec4(clip, 0.0, 1.0);
                gl_PointSize = 1.0;
            }
        `;
      const fragSrc = `#version 300 es
            precision mediump float;
            uniform float u_baseOpacity;
            in float v_fade;
            out vec4 outColor;
            void main() {
                outColor = vec4(0.52, 0.82, 0.94, u_baseOpacity * v_fade);
            }
        `;
      this.microProgram = this.createProgram(vertSrc, fragSrc);
      if (this.microProgram) {
        const gl = this.gl;
        const p = this.microProgram;
        this.microLocs = {
          resolution: gl.getUniformLocation(p, "u_resolution"),
          time: gl.getUniformLocation(p, "u_time"),
          baseOpacity: gl.getUniformLocation(p, "u_baseOpacity"),
          x: gl.getAttribLocation(p, "a_x"),
          baseY: gl.getAttribLocation(p, "a_baseY"),
          speed: gl.getAttribLocation(p, "a_speed"),
          phase: gl.getAttribLocation(p, "a_phase")
        };
      }
    }
    createMicroBuffers() {
      const gl = this.gl;
      const n = this.microParticles.length;
      const xs = new Float32Array(n);
      const baseYs = new Float32Array(n);
      const speeds = new Float32Array(n);
      const phases = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = this.microParticles[i];
        xs[i] = p.x;
        baseYs[i] = p.baseY;
        speeds[i] = p.speed;
        phases[i] = p.phase;
      }
      const upload = (data) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buf;
      };
      this.microBuffers.x = upload(xs);
      this.microBuffers.baseY = upload(baseYs);
      this.microBuffers.speed = upload(speeds);
      this.microBuffers.phase = upload(phases);
      this.microVao = gl.createVertexArray();
      gl.bindVertexArray(this.microVao);
      const ml = this.microLocs;
      const bindM = (loc, buf) => {
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
      };
      bindM(ml.x, this.microBuffers.x);
      bindM(ml.baseY, this.microBuffers.baseY);
      bindM(ml.speed, this.microBuffers.speed);
      bindM(ml.phase, this.microBuffers.phase);
      gl.bindVertexArray(null);
    }
    renderMicro(currentTime) {
      const gl = this.gl;
      if (!this.microProgram) return;
      gl.useProgram(this.microProgram);
      const l = this.microLocs;
      gl.uniform2f(l.resolution, this.width, this.height);
      gl.uniform1f(l.time, currentTime);
      gl.uniform1f(l.baseOpacity, 0.55 * this.qualityMultiplier);
      gl.bindVertexArray(this.microVao);
      const count = Math.floor(this.microParticles.length * this.qualityMultiplier);
      gl.drawArrays(gl.POINTS, 0, count);
    }
    compileShaders() {
      const gl = this.gl;
      const vertexShaderSource = `#version 300 es
            in vec2 a_basePosition;
            in float a_size;
            in float a_driftX;
            in float a_duration;
            in float a_phase;
            in float a_glimmerIntensity;
            in float a_glimmerOffset;
            in float a_glimmerSpeed;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            
            out float v_glimmer;
            
            void main() {
                float progress = mod(u_time / (a_duration * 1000.0), 1.0);
                float angle = progress * 6.28318530718 + a_phase;
                
                float yOffset = sin(angle) * 3.0;
                float driftOffset = sin(angle) * a_driftX;
                
                vec2 position;
                position.x = a_basePosition.x * u_resolution.x + driftOffset;
                position.y = a_basePosition.y * u_resolution.y + yOffset;
                
                vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;
                
                // Bioluminiscence: ostr\xFD z\xE1blesk (mocnina sinus \u2192 vz\xE1cn\xE9 hroty)
                float raw = sin(u_time * 0.0002 * a_glimmerSpeed + a_glimmerOffset);
                float glimmer = pow(max(0.0, raw), 16.0) * a_glimmerIntensity;
                v_glimmer = glimmer;
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_size + glimmer * 1.5;
            }
        `;
      const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            uniform vec3 u_color;
            uniform float u_opacity;
            
            in float v_glimmer;
            out vec4 outColor;
            
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                if (dist > 0.5) {
                    discard;
                }
                
                // J\xE1dro bodu
                float core = smoothstep(0.5, 0.15, dist);
                // M\u011Bkk\xE9 halo / glow kolem j\xE1dra
                float halo = smoothstep(0.5, 0.0, dist) * 0.35;
                float alpha = core + halo;
                
                // Bioluminiscence: posun barvy k modrob\xEDl\xE9 + zesilen\xED jasu
                vec3 glowColor = mix(u_color, vec3(0.65, 0.95, 1.0), v_glimmer);
                float finalOpacity = min(1.0, u_opacity * alpha * (1.0 + v_glimmer * 4.0));
                
                outColor = vec4(glowColor, finalOpacity);
            }
        `;
      this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      if (this.program) {
        const gl2 = this.gl;
        const p = this.program;
        this.locs = {
          resolution: gl2.getUniformLocation(p, "u_resolution"),
          time: gl2.getUniformLocation(p, "u_time"),
          color: gl2.getUniformLocation(p, "u_color"),
          opacity: gl2.getUniformLocation(p, "u_opacity"),
          basePosition: gl2.getAttribLocation(p, "a_basePosition"),
          size: gl2.getAttribLocation(p, "a_size"),
          driftX: gl2.getAttribLocation(p, "a_driftX"),
          duration: gl2.getAttribLocation(p, "a_duration"),
          phase: gl2.getAttribLocation(p, "a_phase"),
          glimmerIntensity: gl2.getAttribLocation(p, "a_glimmerIntensity"),
          glimmerOffset: gl2.getAttribLocation(p, "a_glimmerOffset"),
          glimmerSpeed: gl2.getAttribLocation(p, "a_glimmerSpeed")
        };
      }
    }
    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error:", gl.getShaderInfoLog(vertexShader));
        return null;
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error:", gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return program;
    }
    createBuffers() {
      const gl = this.gl;
      const positions = new Float32Array(this.particles.length * 2);
      const sizes = new Float32Array(this.particles.length);
      const drifts = new Float32Array(this.particles.length);
      const durations = new Float32Array(this.particles.length);
      const phases = new Float32Array(this.particles.length);
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        positions[i * 2] = p.x;
        positions[i * 2 + 1] = p.y;
        sizes[i] = p.size;
        drifts[i] = p.driftX;
        durations[i] = p.duration;
        phases[i] = p.phase;
      }
      const glimmerIntensities = new Float32Array(this.particles.length);
      const glimmerOffsets = new Float32Array(this.particles.length);
      const glimmerSpeeds = new Float32Array(this.particles.length);
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        glimmerIntensities[i] = p.glimmerIntensity;
        glimmerOffsets[i] = p.glimmerOffset;
        glimmerSpeeds[i] = p.glimmerSpeed;
      }
      const upload = (data) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buf;
      };
      this.buffers.position = upload(positions);
      this.buffers.size = upload(sizes);
      this.buffers.drift = upload(drifts);
      this.buffers.duration = upload(durations);
      this.buffers.phase = upload(phases);
      this.buffers.glimmerIntensity = upload(glimmerIntensities);
      this.buffers.glimmerOffset = upload(glimmerOffsets);
      this.buffers.glimmerSpeed = upload(glimmerSpeeds);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const l = this.locs;
      const bindAttr = (loc, buf, size) => {
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      bindAttr(l.basePosition, this.buffers.position, 2);
      bindAttr(l.size, this.buffers.size, 1);
      bindAttr(l.driftX, this.buffers.drift, 1);
      bindAttr(l.duration, this.buffers.duration, 1);
      bindAttr(l.phase, this.buffers.phase, 1);
      bindAttr(l.glimmerIntensity, this.buffers.glimmerIntensity, 1);
      bindAttr(l.glimmerOffset, this.buffers.glimmerOffset, 1);
      bindAttr(l.glimmerSpeed, this.buffers.glimmerSpeed, 1);
      gl.bindVertexArray(null);
    }
    render(currentTime, deltaTime) {
      const gl = this.gl;
      const program = this.program;
      if (!program || this.particles.length === 0) return;
      gl.useProgram(program);
      const locs = this.locs;
      gl.uniform2f(locs.resolution, this.width, this.height);
      gl.uniform1f(locs.time, currentTime);
      gl.uniform3f(locs.color, 0.45, 0.78, 0.95);
      const opacity = 0.45 * this.qualityMultiplier;
      if (this._lastOpacity !== opacity) {
        gl.uniform1f(locs.opacity, opacity);
        this._lastOpacity = opacity;
      }
      gl.bindVertexArray(this.vao);
      const particleCount = Math.floor(this.particles.length * this.qualityMultiplier);
      gl.drawArrays(gl.POINTS, 0, particleCount);
      this.renderMicro(currentTime);
    }
    setQuality(quality) {
      this.qualityMultiplier = quality;
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
    }
    toggle(enabled) {
      this.enabled = !!enabled;
      if (this.enabled && !this.program) {
        if (this.width && this.height) {
          this.init(this.width, this.height);
        }
      }
    }
    destroy() {
      const gl = this.gl;
      if (this.program) gl.deleteProgram(this.program);
      if (this.microProgram) gl.deleteProgram(this.microProgram);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.microVao) gl.deleteVertexArray(this.microVao);
      for (const key in this.buffers) gl.deleteBuffer(this.buffers[key]);
      for (const key in this.microBuffers) gl.deleteBuffer(this.microBuffers[key]);
    }
  };

  // assets/webgl/WebGLOceanRenderer.js
  var WebGLOceanRenderer = class {
    constructor(canvas2, options = {}) {
      this.canvas = canvas2;
      this.gl = null;
      this.rafId = null;
      this.startTime = 0;
      this.lastFrameTime = 0;
      this.frameCount = 0;
      this.fps = 60;
      this.fpsUpdateTime = 0;
      this.lastProfileTimes = null;
      this.resizeTimeout = null;
      this.pendingResize = null;
      this.options = {
        enableGradient: options.enableGradient !== false,
        enableRays: options.enableRays !== false,
        enableBubbles: options.enableBubbles !== false,
        enablePlankton: options.enablePlankton !== false,
        profiling: options.profiling || false,
        // Per-layer config overrides (entity counts, etc.)
        planktonConfig: options.planktonConfig || {},
        bubblesConfig: options.bubblesConfig || {},
        raysConfig: options.raysConfig || {},
        // DPR cap — set by DeviceProfile to prevent memory waste on hi-DPI mobile
        dprCap: options.dprCap || 1.5
      };
      this.qualityMultiplier = 1;
      this.targetFPS = 50;
      this.lowFpsFrames = 0;
      this.handleResize = this.handleResize.bind(this);
      this.handleContextLost = this.handleContextLost.bind(this);
      this.handleContextRestored = this.handleContextRestored.bind(this);
      this.gradientLayer = null;
      this.raysLayer = null;
      this.bubblesLayer = null;
      this.planktonLayer = null;
    }
    init() {
      const gl = this.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        desynchronized: false
      });
      if (!gl) {
        throw new Error("WebGL2 not supported");
      }
      this.gl = gl;
      gl.clearColor(0.02, 0.05, 0.1, 1);
      this.onResize(this.canvas.width, this.canvas.height);
      this.initLayers();
      window.addEventListener("resize", this.handleResize);
      this.canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
      this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored, false);
      return this;
    }
    initLayers() {
      const { width, height } = this.canvas;
      if (this.options.enableGradient) {
        this.gradientLayer = new WaterGradientLayer(this.gl);
        this.gradientLayer.init(width, height);
        this.gradientLayer.enabled = true;
      }
      if (this.options.enableRays) {
        this.raysLayer = new LightRaysLayer(this.gl, this.options.raysConfig);
        this.raysLayer.init(width, height);
        this.raysLayer.enabled = true;
      }
      if (this.options.enableBubbles) {
        this.bubblesLayer = new BubblesLayer(this.gl, this.options.bubblesConfig);
        this.bubblesLayer.init(width, height);
        this.bubblesLayer.enabled = true;
      }
      if (this.options.enablePlankton) {
        this.planktonLayer = new PlanktonLayer(this.gl, this.options.planktonConfig);
        this.planktonLayer.init(width, height);
        this.planktonLayer.enabled = true;
      }
    }
    handleContextLost(e) {
      e.preventDefault();
      this.gl = null;
      console.warn("WebGL context lost \u2014 rendering paused until restored");
    }
    handleContextRestored() {
      console.log("WebGL context restored \u2014 reinitialising");
      const gl = this.canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        desynchronized: false
      });
      if (!gl) return;
      this.gl = gl;
      gl.clearColor(0.02, 0.05, 0.1, 1);
      this.onResize(this.canvas.width, this.canvas.height);
      this.gradientLayer = null;
      this.raysLayer = null;
      this.bubblesLayer = null;
      this.planktonLayer = null;
      this.initLayers();
    }
    handleResize() {
      clearTimeout(this.resizeTimeout);
      this.pendingResize = {
        dpr: Math.min(window.devicePixelRatio || 1, this.options.dprCap),
        width: window.innerWidth,
        height: window.innerHeight
      };
      this.resizeTimeout = setTimeout(() => {
        this.applyResize();
      }, 150);
    }
    applyResize() {
      if (!this.pendingResize) return;
      const { dpr, width, height } = this.pendingResize;
      const canvasWidth = Math.floor(width * dpr);
      const canvasHeight = Math.floor(height * dpr);
      this.onResize(canvasWidth, canvasHeight);
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.pendingResize = null;
    }
    onResize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.gl) {
        this.gl.viewport(0, 0, width, height);
        if (this.gradientLayer) this.gradientLayer.onResize(width, height);
        if (this.raysLayer) this.raysLayer.onResize(width, height);
        if (this.bubblesLayer) this.bubblesLayer.onResize(width, height);
        if (this.planktonLayer) this.planktonLayer.onResize(width, height);
      }
    }
    start() {
      if (this.rafId) return;
      this.startTime = performance.now();
      this.lastFrameTime = this.startTime;
      this.fpsUpdateTime = this.startTime;
      this.frameCount = 0;
      console.log("WebGL renderer ready (controlled by MasterRenderer)");
    }
    stop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    renderFrame(currentTime, deltaTime) {
      this.lastFrameTime = currentTime;
      const profiling = this.options.profiling || false;
      const times = {};
      if (profiling) times.start = performance.now();
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      if (profiling) times.clear = performance.now();
      if (this.gradientLayer && this.gradientLayer.enabled) {
        this.gradientLayer.render(currentTime, deltaTime);
      }
      if (profiling) times.gradient = performance.now();
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
      if (this.raysLayer && this.raysLayer.enabled) {
        this.raysLayer.render(currentTime, deltaTime);
      }
      if (profiling) times.rays = performance.now();
      if (this.bubblesLayer && this.bubblesLayer.enabled) {
        this.bubblesLayer.render(currentTime, deltaTime);
      }
      if (profiling) times.bubbles = performance.now();
      if (this.planktonLayer && this.planktonLayer.enabled) {
        this.planktonLayer.render(currentTime, deltaTime);
      }
      if (profiling) {
        times.plankton = performance.now();
        times.total = times.plankton - times.start;
        this.lastProfileTimes = {
          gradient: times.gradient - times.clear,
          rays: times.rays - times.gradient,
          bubbles: times.bubbles - times.rays,
          plankton: times.plankton - times.bubbles,
          total: times.total
        };
        if (!this._lastProfileLog || currentTime - this._lastProfileLog > 2e3) {
          console.group("WebGL Performance Profile");
          console.log(`Total Frame: ${times.total.toFixed(2)}ms`);
          console.log(`Gradient: ${(times.gradient - times.clear).toFixed(2)}ms`);
          console.log(`Light Rays: ${(times.rays - times.gradient).toFixed(2)}ms`);
          console.log(`Bubbles: ${(times.bubbles - times.rays).toFixed(2)}ms`);
          console.log(`Plankton: ${(times.plankton - times.bubbles).toFixed(2)}ms`);
          console.groupEnd();
          this._lastProfileLog = currentTime;
        }
      }
      this.gl.disable(this.gl.BLEND);
      this.updateFPS(currentTime, deltaTime);
    }
    updateFPS(currentTime, deltaTime) {
      this.frameCount++;
      if (currentTime - this.fpsUpdateTime >= 1e3) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.fpsUpdateTime = currentTime;
        if (this.fps < this.targetFPS) {
          this.lowFpsFrames++;
          if (this.lowFpsFrames > 3 && this.qualityMultiplier > 0.5) {
            this.qualityMultiplier *= 0.9;
            this.applyQualitySettings();
          }
        } else {
          this.lowFpsFrames = 0;
          if (this.qualityMultiplier < 1) {
            this.qualityMultiplier = Math.min(1, this.qualityMultiplier * 1.05);
            this.applyQualitySettings();
          }
        }
      }
    }
    applyQualitySettings() {
      if (this.bubblesLayer) {
        this.bubblesLayer.setQuality(this.qualityMultiplier);
      }
      if (this.planktonLayer) {
        this.planktonLayer.setQuality(this.qualityMultiplier);
      }
    }
    setLayerEnabled(name, enabled) {
      switch (name) {
        case "gradient":
          this.options.enableGradient = enabled;
          if (this.gradientLayer) {
            if (typeof this.gradientLayer.toggle === "function") {
              this.gradientLayer.toggle(enabled);
            } else {
              this.gradientLayer.enabled = enabled;
              if (enabled && !this.gradientLayer.program) this.gradientLayer.init(this.canvas.width, this.canvas.height);
            }
          } else if (enabled && this.gl) {
            this.gradientLayer = new WaterGradientLayer(this.gl);
            this.gradientLayer.init(this.canvas.width, this.canvas.height);
            this.gradientLayer.enabled = true;
          }
          break;
        case "rays":
          this.options.enableRays = enabled;
          if (this.raysLayer) {
            if (typeof this.raysLayer.toggle === "function") {
              this.raysLayer.toggle(enabled);
            } else {
              this.raysLayer.enabled = enabled;
              if (enabled && !this.raysLayer.program) this.raysLayer.init(this.canvas.width, this.canvas.height);
            }
          } else if (enabled && this.gl) {
            this.raysLayer = new LightRaysLayer(this.gl, this.options.raysConfig);
            this.raysLayer.init(this.canvas.width, this.canvas.height);
            this.raysLayer.enabled = true;
          }
          break;
        case "bubbles":
          this.options.enableBubbles = enabled;
          if (this.bubblesLayer) {
            if (typeof this.bubblesLayer.toggle === "function") {
              this.bubblesLayer.toggle(enabled);
            } else {
              this.bubblesLayer.enabled = enabled;
              if (enabled && !this.bubblesLayer.program) this.bubblesLayer.init(this.canvas.width, this.canvas.height);
            }
          } else if (enabled && this.gl) {
            this.bubblesLayer = new BubblesLayer(this.gl, this.options.bubblesConfig);
            this.bubblesLayer.init(this.canvas.width, this.canvas.height);
            this.bubblesLayer.enabled = true;
          }
          break;
        case "plankton":
          this.options.enablePlankton = enabled;
          if (this.planktonLayer) {
            if (typeof this.planktonLayer.toggle === "function") {
              this.planktonLayer.toggle(enabled);
            } else {
              this.planktonLayer.enabled = enabled;
              if (enabled && !this.planktonLayer.program) this.planktonLayer.init(this.canvas.width, this.canvas.height);
            }
          } else if (enabled && this.gl) {
            this.planktonLayer = new PlanktonLayer(this.gl, this.options.planktonConfig);
            this.planktonLayer.init(this.canvas.width, this.canvas.height);
            this.planktonLayer.enabled = true;
          }
          break;
      }
    }
    getFPS() {
      return this.fps;
    }
    /**
     * Apply a quality multiplier to all particle layers.
     * Called by MasterRenderer to synchronise WebGL quality with the Canvas 2D
     * PerformanceMonitor so both subsystems respond to the same FPS signal.
     * @param {number} quality - 0.3–1.0
     */
    setQuality(quality) {
      this.qualityMultiplier = quality;
      if (this.bubblesLayer) this.bubblesLayer.setQuality(quality);
      if (this.planktonLayer) this.planktonLayer.setQuality(quality);
    }
    destroy() {
      this.stop();
      if (this.gradientLayer) this.gradientLayer.destroy();
      if (this.raysLayer) this.raysLayer.destroy();
      if (this.bubblesLayer) this.bubblesLayer.destroy();
      if (this.planktonLayer) this.planktonLayer.destroy();
      window.removeEventListener("resize", this.handleResize);
      this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
      this.gl = null;
    }
  };

  // assets/canvas/utils/DeviceProfile.js
  var BUDGETS = [
    // Tier 0 — mobile-low
    {
      swarmCount: 5,
      particlesPerSwarm: 15,
      fineCount: 150,
      microCount: 50,
      lightRayCount: 2,
      bubbleSourceWidthBase: 900,
      schoolDensity: 15e4,
      canvas2dFPS: 30,
      dprCap: 1
    },
    // Tier 1 — mobile-medium
    {
      swarmCount: 12,
      particlesPerSwarm: 30,
      fineCount: 400,
      microCount: 150,
      lightRayCount: 3,
      bubbleSourceWidthBase: 700,
      schoolDensity: 18e4,
      canvas2dFPS: 35,
      dprCap: 1.25
    },
    // Tier 2 — desktop-light
    {
      swarmCount: 20,
      particlesPerSwarm: 45,
      fineCount: 900,
      microCount: 300,
      lightRayCount: 4,
      bubbleSourceWidthBase: 550,
      schoolDensity: 22e4,
      canvas2dFPS: 40,
      dprCap: 1.5
    },
    // Tier 3 — desktop-full
    {
      swarmCount: 30,
      particlesPerSwarm: 50,
      fineCount: 1500,
      microCount: 500,
      lightRayCount: 5,
      bubbleSourceWidthBase: 400,
      schoolDensity: 25e4,
      canvas2dFPS: 45,
      dprCap: 2
    }
  ];
  var TIER_LABELS = ["mobile-low", "mobile-medium", "desktop-light", "desktop-full"];
  var _cached = null;
  function getDeviceProfile() {
    if (_cached) return _cached;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const area = vw * vh;
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = window.devicePixelRatio || 1;
    const connType = navigator.connection?.effectiveType ?? "";
    let tier;
    if (area < 35e4 || connType === "2g" || connType === "slow-2g" || cores <= 2 && dpr > 1.5) {
      tier = 0;
    } else if (area < 6e5 || cores <= 2) {
      tier = 1;
    } else if (area < 15e5 || cores <= 4) {
      tier = 2;
    } else {
      tier = 3;
    }
    _cached = {
      tier,
      label: TIER_LABELS[tier],
      entityBudget: BUDGETS[tier]
    };
    console.info(
      `[DeviceProfile] tier=${tier} (${_cached.label}) | ${vw}\xD7${vh}px | cores=${cores} dpr=${dpr} conn=${connType || "unknown"}`
    );
    return _cached;
  }

  // assets/webgl/init-prod.js
  var canvas = document.getElementById("webgl-ocean-background");
  if (canvas) {
    const { tier, label, entityBudget: budget } = getDeviceProfile();
    if (tier === 0) {
      console.info(`[WebGL] Skipping WebGL on ${label} device \u2014 CSS fallback active`);
      window.webglOceanRenderer = null;
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, budget.dprCap);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const renderer = new WebGLOceanRenderer(canvas, {
        enableGradient: true,
        enableRays: true,
        enableBubbles: true,
        enablePlankton: true,
        profiling: false,
        dprCap: budget.dprCap,
        raysConfig: {
          rayCount: budget.lightRayCount
        },
        bubblesConfig: {
          sourceWidthBase: budget.bubbleSourceWidthBase
        },
        planktonConfig: {
          swarmCount: budget.swarmCount,
          particlesPerSwarm: budget.particlesPerSwarm,
          fineCount: budget.fineCount,
          microCount: budget.microCount
        }
      });
      try {
        renderer.init();
        console.log(`[WebGL] Ocean Renderer initialized (tier=${tier} ${label}, awaiting MasterRenderer)`);
      } catch (error) {
        console.warn("WebGL2 not available, falling back to CSS background:", error.message);
      }
      window.webglOceanRenderer = renderer;
    }
  }

  // assets/canvas/utils/MathUtils.js
  var MathUtils = class {
    constructor() {
      this.sinCache = new Float32Array(360);
      this.cosCache = new Float32Array(360);
      for (let i = 0; i < 360; i++) {
        const rad = i * Math.PI / 180;
        this.sinCache[i] = Math.sin(rad);
        this.cosCache[i] = Math.cos(rad);
      }
      this.tempVec2 = { x: 0, y: 0 };
    }
    /**
     * Get cached sine value for degree (0-359)
     * @param {number} degree - Angle in degrees
     * @returns {number} Sine value
     */
    sin(degree) {
      const index = Math.floor(degree) % 360;
      return this.sinCache[index < 0 ? index + 360 : index];
    }
    /**
     * Get cached cosine value for degree (0-359)
     * @param {number} degree - Angle in degrees
     * @returns {number} Cosine value
     */
    cos(degree) {
      const index = Math.floor(degree) % 360;
      return this.cosCache[index < 0 ? index + 360 : index];
    }
    /**
     * Get cached sine value from radians
     * @param {number} rad - Angle in radians
     * @returns {number} Sine value
     */
    sinRad(rad) {
      const degree = Math.floor(rad * 180 / Math.PI) % 360;
      return this.sinCache[degree < 0 ? degree + 360 : degree];
    }
    /**
     * Get cached cosine value from radians
     * @param {number} rad - Angle in radians
     * @returns {number} Cosine value
     */
    cosRad(rad) {
      const degree = Math.floor(rad * 180 / Math.PI) % 360;
      return this.cosCache[degree < 0 ? degree + 360 : degree];
    }
    /**
     * Calculate distance between two points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Distance
     */
    distance(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
    /**
     * Calculate squared distance (faster, no sqrt)
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Squared distance
     */
    distanceSquared(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return dx * dx + dy * dy;
    }
    /**
     * Linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(a, b, t) {
      return a + (b - a) * t;
    }
    /**
     * Clamp value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    /**
     * Map value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number} Mapped value
     */
    map(value, inMin, inMax, outMin, outMax) {
      return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }
    /**
     * Generate random number in range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random value
     */
    random(min, max) {
      return min + Math.random() * (max - min);
    }
    /**
     * Generate random integer in range
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @returns {number} Random integer
     */
    randomInt(min, max) {
      return Math.floor(this.random(min, max + 1));
    }
  };

  // assets/canvas/utils/PerformanceMonitor.js
  var PerformanceMonitor = class {
    constructor(options = {}) {
      this.metrics = {
        fps: 60,
        frameTime: 0,
        frameTimeHistory: new Array(60).fill(16.67),
        // Pre-allocate circular buffer
        frameTimeIndex: 0,
        // Current write index
        frameTimeCount: 0,
        // Number of frames recorded (max 60)
        lastFpsUpdate: 0
      };
      this.showStats = options.showStats !== false;
      this.qualitySettings = {
        current: 1,
        target: 1,
        min: 0.3,
        max: 1,
        targetFPS: options.targetFPS || 45,
        adjustInterval: 1e3
      };
      this.lastQualityAdjustment = 0;
      this.qualityChangeListeners = [];
    }
    /**
     * Toggle performance stats display
     */
    toggleStats() {
      this.showStats = !this.showStats;
      console.log("Performance stats:", this.showStats ? "ON" : "OFF");
      return this.showStats;
    }
    /**
     * Update performance metrics
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     */
    update(currentTime, deltaTime) {
      this.metrics.frameTime = deltaTime;
      this.metrics.frameTimeHistory[this.metrics.frameTimeIndex] = deltaTime;
      this.metrics.frameTimeIndex = (this.metrics.frameTimeIndex + 1) % 60;
      if (this.metrics.frameTimeCount < 60) {
        this.metrics.frameTimeCount++;
      }
      if (currentTime - this.metrics.lastFpsUpdate > 500) {
        let sum = 0;
        for (let i = 0; i < this.metrics.frameTimeCount; i++) {
          sum += this.metrics.frameTimeHistory[i];
        }
        const avgFrameTime = sum / this.metrics.frameTimeCount;
        this.metrics.fps = Math.round(1e3 / avgFrameTime);
        this.metrics.lastFpsUpdate = currentTime;
        if (currentTime - this.lastQualityAdjustment > this.qualitySettings.adjustInterval) {
          this.adjustQuality();
          this.lastQualityAdjustment = currentTime;
        }
      }
    }
    /**
     * Adjust quality based on current FPS
     * @private
     */
    adjustQuality() {
      const fps = this.metrics.fps;
      const target = this.qualitySettings.targetFPS;
      const oldQuality = this.qualitySettings.current;
      if (fps < target - 5) {
        this.qualitySettings.current = Math.max(
          this.qualitySettings.min,
          this.qualitySettings.current - 0.1
        );
      } else if (fps > target + 10 && this.qualitySettings.current < this.qualitySettings.max) {
        this.qualitySettings.current = Math.min(
          this.qualitySettings.max,
          this.qualitySettings.current + 0.05
        );
      }
      if (oldQuality !== this.qualitySettings.current) {
        this.notifyQualityChange(this.qualitySettings.current);
      }
    }
    /**
     * Register listener for quality changes
     * @param {Function} callback - Callback function receiving new quality value
     */
    onQualityChange(callback) {
      this.qualityChangeListeners.push(callback);
    }
    /**
     * Notify all listeners about quality change
     * @private
     * @param {number} newQuality - New quality value
     */
    notifyQualityChange(newQuality) {
      this.qualityChangeListeners.forEach((listener) => {
        try {
          listener(newQuality);
        } catch (error) {
          console.error("Error in quality change listener:", error);
        }
      });
    }
    /**
     * Get current quality multiplier
     * @returns {number} Quality value (0.3 to 1.0)
     */
    getQuality() {
      return this.qualitySettings.current;
    }
    /**
     * Get current FPS
     * @returns {number} Frames per second
     */
    getFPS() {
      return this.metrics.fps;
    }
  };

  // assets/canvas/utils/PerformanceProfiler.js
  var PerformanceProfiler = class {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.logInterval = options.logInterval || 2e3;
      this.lastLogTime = 0;
      this.currentFrame = {};
      this.stats = {
        frameCount: 0,
        totalFrameTime: 0,
        foodUpdate: { total: 0, count: 0, max: 0 },
        layers: /* @__PURE__ */ new Map(),
        // name -> { total, count, max }
        performanceMonitor: { total: 0, count: 0, max: 0 },
        other: { total: 0, count: 0, max: 0 }
      };
      this.markers = [];
    }
    /**
     * Začít měřit frame
     */
    startFrame() {
      if (!this.enabled) return;
      this.currentFrame.start = performance.now();
      this.markers = [];
    }
    /**
     * Začít měřit section
     * @param {string} name - Název sekce
     */
    startSection(name) {
      if (!this.enabled) return;
      this.markers.push({
        name,
        start: performance.now(),
        type: "start"
      });
    }
    /**
     * Ukončit měření section
     * @param {string} name - Název sekce
     */
    endSection(name) {
      if (!this.enabled) return;
      const end = performance.now();
      for (let i = this.markers.length - 1; i >= 0; i--) {
        if (this.markers[i].name === name && this.markers[i].type === "start") {
          const duration = end - this.markers[i].start;
          this.markers[i].duration = duration;
          this.markers[i].type = "complete";
          this._updateStats(name, duration);
          break;
        }
      }
    }
    /**
     * Ukončit frame a spočítat celkový čas
     */
    endFrame(currentTime) {
      if (!this.enabled) return;
      const frameTime = performance.now() - this.currentFrame.start;
      this.stats.frameCount++;
      this.stats.totalFrameTime += frameTime;
      if (currentTime - this.lastLogTime > this.logInterval) {
        this.logStats();
        this.lastLogTime = currentTime;
      }
    }
    /**
     * Update statistiky pro danou sekci
     * @private
     */
    _updateStats(name, duration) {
      let stat;
      if (name === "foodUpdate") {
        stat = this.stats.foodUpdate;
      } else if (name === "performanceMonitor") {
        stat = this.stats.performanceMonitor;
      } else if (name.startsWith("layer:")) {
        const layerName = name.substring(6);
        if (!this.stats.layers.has(layerName)) {
          this.stats.layers.set(layerName, { total: 0, count: 0, max: 0 });
        }
        stat = this.stats.layers.get(layerName);
      } else {
        stat = this.stats.other;
      }
      stat.total += duration;
      stat.count++;
      if (duration > stat.max) {
        stat.max = duration;
      }
    }
    /**
     * Logovat statistiky do konzole
     */
    logStats() {
      if (this.stats.frameCount === 0) return;
      const avgFrameTime = this.stats.totalFrameTime / this.stats.frameCount;
      const fps = 1e3 / avgFrameTime;
      console.group(`\u{1F50D} Performance Profile (${this.stats.frameCount} frames)`);
      console.log(`\u{1F4CA} Average Frame Time: ${avgFrameTime.toFixed(2)}ms (${fps.toFixed(1)} FPS)`);
      if (this.stats.foodUpdate.count > 0) {
        const avg = this.stats.foodUpdate.total / this.stats.foodUpdate.count;
        const pct = (avg / avgFrameTime * 100).toFixed(1);
        console.log(`\u{1F354} Food Update: ${avg.toFixed(2)}ms avg, ${this.stats.foodUpdate.max.toFixed(2)}ms max (${pct}%)`);
      }
      if (this.stats.layers.size > 0) {
        console.log("\u{1F4E6} Layers:");
        const sortedLayers = Array.from(this.stats.layers.entries()).sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count);
        sortedLayers.forEach(([name, stat]) => {
          const avg = stat.total / stat.count;
          const pct = (avg / avgFrameTime * 100).toFixed(1);
          console.log(`  - ${name}: ${avg.toFixed(2)}ms avg, ${stat.max.toFixed(2)}ms max (${pct}%)`);
        });
      }
      if (this.stats.performanceMonitor.count > 0) {
        const avg = this.stats.performanceMonitor.total / this.stats.performanceMonitor.count;
        const pct = (avg / avgFrameTime * 100).toFixed(1);
        console.log(`\u{1F4C8} Perf Monitor: ${avg.toFixed(2)}ms avg, ${this.stats.performanceMonitor.max.toFixed(2)}ms max (${pct}%)`);
      }
      if (this.stats.other.count > 0) {
        const avg = this.stats.other.total / this.stats.other.count;
        const pct = (avg / avgFrameTime * 100).toFixed(1);
        console.log(`\u2699\uFE0F Other: ${avg.toFixed(2)}ms avg, ${this.stats.other.max.toFixed(2)}ms max (${pct}%)`);
      }
      console.groupEnd();
      this.resetStats();
    }
    /**
     * Reset statistiky
     */
    resetStats() {
      this.stats.frameCount = 0;
      this.stats.totalFrameTime = 0;
      this.stats.foodUpdate = { total: 0, count: 0, max: 0 };
      this.stats.layers.clear();
      this.stats.performanceMonitor = { total: 0, count: 0, max: 0 };
      this.stats.other = { total: 0, count: 0, max: 0 };
    }
    /**
     * Enable/disable profiling
     */
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) {
        this.resetStats();
      }
    }
    /**
     * Get sections data in format compatible with MasterRenderer
     * @returns {Object} Sections with avg/max timing
     */
    get sections() {
      const result = {};
      if (this.stats.foodUpdate.count > 0) {
        result.foodUpdate = {
          avg: this.stats.foodUpdate.total / this.stats.foodUpdate.count,
          max: this.stats.foodUpdate.max
        };
      }
      this.stats.layers.forEach((stat, name) => {
        result[`layer:${name}`] = {
          avg: stat.total / stat.count,
          max: stat.max
        };
      });
      if (this.stats.performanceMonitor.count > 0) {
        result.performanceMonitor = {
          avg: this.stats.performanceMonitor.total / this.stats.performanceMonitor.count,
          max: this.stats.performanceMonitor.max
        };
      }
      return result;
    }
  };

  // assets/canvas/layers/FoodLayer.js
  var FoodLayer = class _FoodLayer {
    // Single source of truth for food particle configuration
    static DEFAULT_CONFIG = {
      count: 3,
      size: 5,
      fallSpeed: 0.08,
      spread: 30,
      shrinkRate: 0.05
      // pixels per second (5px takes ~100 seconds to vanish)
    };
    constructor(mathUtils, configRef = {}) {
      this.mathUtils = mathUtils;
      this._particles = [];
      this._particlePool = [];
      this.config = {
        ..._FoodLayer.DEFAULT_CONFIG,
        ...configRef
        // Override with provided config
      };
      this.colorLUT = this._generateColorLUT();
      this.renderableParticles = [];
      this.sparkleParticles = [];
      this.renderStrokes = true;
      this.renderSparkles = true;
      this.useSimpleGlimmer = false;
      this.MAX_PARTICLES = 100;
    }
    /**
     * Generate color lookup tables to eliminate per-frame rgba() string creation
     * @private
     * @returns {Object} Color lookup tables
     */
    _generateColorLUT() {
      const lut = {
        fill: [],
        // Fill colors by glimmer intensity
        stroke: [],
        // Stroke colors by glimmer intensity
        sparkle: []
        // Sparkle colors by opacity
      };
      for (let i = 0; i < 256; i++) {
        const glimmer = i / 255;
        const hueVariation = Math.floor(i / 85) % 3;
        let r = 255, g, b = 0;
        if (hueVariation === 0) {
          g = Math.floor(100 + glimmer * 155);
        } else if (hueVariation === 1) {
          g = Math.floor(140 + glimmer * 115);
        } else {
          g = Math.floor(180 + glimmer * 75);
        }
        lut.fill[i] = `rgba(${r},${g},${b},1)`;
        lut.stroke[i] = `rgba(255,230,100,${glimmer})`;
      }
      for (let i = 0; i < 256; i++) {
        lut.sparkle[i] = `rgba(255,255,255,${i / 255})`;
      }
      return lut;
    }
    /**
     * Get particle from pool or create new one
     * @private
     * @returns {Object} Particle object
     */
    getFromPool() {
      return this._particlePool.pop() || {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        initialSize: 0,
        opacity: 1,
        eaten: false,
        age: 0,
        lifetime: 0,
        glimmerPhase: 0,
        isTargeted: false,
        glimmer: 0.5,
        currentSize: 0
      };
    }
    /**
     * Return particle to pool
     * @private
     * @param {Object} particle - Particle to return
     */
    returnToPool(particle) {
      this._particlePool.push(particle);
    }
    /**
     * Spawn food particles at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} qualityMultiplier - Quality setting (0.3-1.0) - NOT used for count anymore
     */
    spawn(x, y, qualityMultiplier = 1) {
      if (this._particles.length >= this.MAX_PARTICLES) {
        return;
      }
      const particleCount = this.config.count;
      const actualCount = Math.min(particleCount, this.MAX_PARTICLES - this._particles.length);
      const baseSize = this.config.size;
      const fallSpeed = this.config.fallSpeed;
      const spread = this.config.spread;
      for (let i = 0; i < actualCount; i++) {
        const particle = this.getFromPool();
        particle.x = x + (Math.random() - 0.5) * spread;
        particle.y = y + (Math.random() - 0.5) * spread;
        particle.vx = (Math.random() - 0.5) * 0.3;
        particle.vy = Math.random() * fallSpeed * 1.5 + fallSpeed;
        particle.size = baseSize * 0.7 + Math.random() * baseSize * 0.6;
        particle.initialSize = particle.size;
        particle.lifetime = particle.size / this.config.shrinkRate * 1e3;
        particle.currentSize = particle.initialSize;
        particle.opacity = 1;
        particle.eaten = false;
        particle.age = 0;
        particle.glimmerPhase = Math.random() * Math.PI * 2;
        particle.isTargeted = false;
        particle.glimmer = 0.5;
        this._particles.push(particle);
      }
    }
    /**
     * Reset all targeted flags
     */
    resetTargetedFlags() {
      for (let i = 0, len = this._particles.length; i < len; i++) {
        this._particles[i].isTargeted = false;
      }
    }
    /**
     * Update and render food particles with batched rendering
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} deltaTime - Time since last frame
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} qualityMultiplier - Quality setting (0.3-1.0)
     */
    update(ctx, deltaTime, width, height, qualityMultiplier = 1) {
      const len = this._particles.length;
      if (len === 0) return;
      this._updateLODFlags(qualityMultiplier);
      const dt = Math.min(deltaTime, 50);
      this.renderableParticles.length = 0;
      this.sparkleParticles.length = 0;
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < this._particles.length; readIndex++) {
        const food = this._particles[readIndex];
        if (food.eaten) {
          this.returnToPool(food);
          continue;
        }
        food.x += food.vx * (dt / 16.67);
        food.y += food.vy * (dt / 16.67);
        food.age += dt;
        const normalizedLife = Math.min(1, food.age / food.lifetime);
        food.currentSize = food.initialSize * (1 - normalizedLife);
        if (normalizedLife >= 1 || food.currentSize < 0.1) {
          this.returnToPool(food);
          continue;
        }
        const sizeRatio = food.currentSize / food.initialSize;
        food.opacity = sizeRatio < 0.2 ? sizeRatio * 5 : 1;
        if (food.y >= height - 20) {
          food.y = height - 20;
          food.vy = 0;
          food.vx *= 0.95;
        }
        if (food.x >= -50 && food.x <= width + 50 && food.y >= -50) {
          food.glimmerPhase += dt * 5e-3;
          const glimmerIndex = Math.floor(food.glimmerPhase % (Math.PI * 2) / (Math.PI * 2) * 360) | 0;
          food.glimmer = this.mathUtils.sin(glimmerIndex) * 0.5 + 0.5;
          this.renderableParticles.push(food);
          if (this.renderSparkles && food.glimmer > 0.7) {
            this.sparkleParticles.push(food);
          }
        }
        this._particles[writeIndex++] = food;
      }
      this._particles.length = writeIndex;
      this._renderBatched(ctx);
    }
    /**
     * Update LOD flags based on quality multiplier
     * @private
     * @param {number} quality - Quality multiplier (0.3-1.0)
     */
    _updateLODFlags(quality) {
      if (quality >= 0.8) {
        this.renderStrokes = true;
        this.renderSparkles = true;
        this.useSimpleGlimmer = false;
      } else if (quality >= 0.5) {
        this.renderStrokes = true;
        this.renderSparkles = false;
        this.useSimpleGlimmer = false;
      } else {
        this.renderStrokes = false;
        this.renderSparkles = false;
        this.useSimpleGlimmer = true;
      }
    }
    /**
     * Render particles (optimized for small counts < 50)
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _renderBatched(ctx) {
      const count = this.renderableParticles.length;
      if (count === 0) return;
      for (let i = 0; i < count; i++) {
        const food = this.renderableParticles[i];
        const glimmerIdx = Math.floor(food.glimmer * 255) | 0;
        const size = food.currentSize;
        if (food.opacity >= 0.99) {
          ctx.fillStyle = this.colorLUT.fill[glimmerIdx];
        } else {
          const g = 100 + Math.floor(food.glimmer * 155);
          ctx.fillStyle = `rgba(255,${g},0,${food.opacity})`;
        }
        ctx.beginPath();
        this._appendDiamond(ctx, food.x, food.y, size);
        ctx.fill();
      }
      if (this.renderStrokes && count > 0) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = this.colorLUT.stroke[180];
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const food = this.renderableParticles[i];
          const size = food.currentSize;
          this._appendDiamond(ctx, food.x, food.y, size);
        }
        ctx.stroke();
      }
      if (this.renderSparkles && this.sparkleParticles.length > 0) {
        for (let i = 0; i < this.sparkleParticles.length; i++) {
          const food = this.sparkleParticles[i];
          const sparkleOpacity = (food.glimmer - 0.7) * food.opacity;
          const opacityIdx = Math.floor(Math.max(0, Math.min(1, sparkleOpacity)) * 255) | 0;
          ctx.fillStyle = this.colorLUT.sparkle[opacityIdx];
          ctx.fillRect(food.x - 1, food.y - 1, 2, 2);
        }
      }
    }
    /**
     * Append diamond shape to current path (for batch rendering)
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Diamond size
     */
    _appendDiamond(ctx, x, y, size) {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.7, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.7, y);
      ctx.closePath();
    }
    /**
     * Get all particles for AI layer access
     * Layers may read positions and set eaten/isTargeted flags
     * @returns {Array} Array of food particles
     */
    getParticles() {
      return this._particles;
    }
    /**
     * Get number of active particles
     * @returns {number} Particle count
     */
    getCount() {
      return this._particles.length;
    }
    /**
     * Update configuration at runtime (e.g., from ice-switcher UI)
     * @param {Object} newConfig - Partial config to merge with current
     */
    updateConfig(newConfig) {
      Object.assign(this.config, newConfig);
    }
    /**
     * Clear all particles
     */
    clear() {
      this._particles.forEach((p) => this.returnToPool(p));
      this._particles.length = 0;
    }
    /**
     * Cleanup resources
     */
    destroy() {
      this.clear();
      this._particlePool = [];
      console.log("FoodLayer destroyed");
    }
  };

  // assets/canvas/curious-fish/scenarios/MatingScenario.js
  function initiateMatingDance(fish, partner, currentTime = performance.now()) {
    console.log("Starting romantic dance with partner!");
    partner.isDancing = true;
    if (partner.velocityX !== void 0) partner.velocityX = 0;
    if (partner.velocityY !== void 0) partner.velocityY = 0;
    return {
      phase: 0,
      // 0=approach 1=choreography 2=kiss 3=complete
      startTime: currentTime,
      kissStartTime: null,
      bigHeart: null,
      progress: 0,
      danceStep: 0,
      danceSteps: null,
      // built when phase 0 ends
      stepStartTime: null,
      _approachMax: null,
      _stepMidX: 0,
      _stepMidY: 0
    };
  }
  function _buildDanceSteps() {
    return [
      { type: "orbit_close", duration: 2800 },
      // tight mutual orbit, 2.5 rotations
      { type: "spin_flip", duration: 2600 },
      // side-by-side smooth X-axis barrel-rolls
      { type: "spiral_in", duration: 1600 }
      // spiral inward until collision
    ];
  }
  function _stepDanceChoreography(danceState, fish, partner, deltaTime, currentTime, spawnHeart) {
    const steps = danceState.danceSteps;
    if (!steps || danceState.danceStep >= steps.length) return true;
    const step = steps[danceState.danceStep];
    if (!danceState.stepStartTime) {
      danceState.stepStartTime = currentTime;
      danceState._stepMidX = (fish.x + partner.x) / 2;
      danceState._stepMidY = (fish.y + (partner.baseY !== void 0 ? partner.baseY : partner.y)) / 2;
      danceState._baseAngle = Math.atan2(
        fish.y - danceState._stepMidY,
        fish.x - danceState._stepMidX
      );
    }
    const elapsed = currentTime - danceState.stepStartTime;
    const t = Math.min(elapsed / step.duration, 1);
    const midX = danceState._stepMidX;
    const midY = danceState._stepMidY;
    const baseR = Math.max(28, (fish.currentSize + partner.size) * 0.38);
    if (Math.random() < 0.04) spawnHeart();
    if (step.type === "orbit_close") {
      const angle = danceState._baseAngle + t * Math.PI * 5;
      fish.x = midX + Math.cos(angle) * baseR;
      fish.y = midY + Math.sin(angle) * baseR;
      fish.velocityX = 0;
      fish.velocityY = 0;
      fish.rotation = 0;
      fish.targetRotation = 0;
      const goRight = -Math.sin(angle) >= 0;
      fish.flipScale = goRight ? 1 : -1;
      fish.targetFlipScale = fish.flipScale;
      partner.x = midX + Math.cos(angle + Math.PI) * baseR;
      const pY = midY + Math.sin(angle + Math.PI) * baseR;
      if (partner.baseY !== void 0) partner.baseY = pY;
      else partner.y = pY;
      partner.direction = goRight ? -1 : 1;
      partner.flipX = void 0;
    } else if (step.type === "spin_flip") {
      const N = 3;
      const flipAngle = t * N * Math.PI * 2;
      const yBounce = Math.sin(flipAngle) * (fish.currentSize * 0.38);
      const r = baseR;
      fish.x = midX - r;
      fish.y = midY + yBounce;
      fish.velocityX = 0;
      fish.velocityY = 0;
      fish.rotation = 0;
      fish.targetRotation = 0;
      fish.flipScale = Math.cos(flipAngle);
      fish.targetFlipScale = fish.flipScale;
      partner.x = midX + r;
      const pY = midY - yBounce;
      if (partner.baseY !== void 0) partner.baseY = pY;
      else partner.y = pY;
      partner.flipX = Math.cos(flipAngle + Math.PI);
      partner.direction = partner.flipX >= 0 ? -1 : 1;
      if (Math.abs(Math.cos(flipAngle)) < 0.12 && Math.random() < 0.45) spawnHeart();
    } else if (step.type === "spiral_in") {
      const ease = t * t;
      const spiralR = baseR * (1 - ease);
      const angle = danceState._baseAngle + t * Math.PI * 0.5;
      fish.x = midX + Math.cos(angle) * spiralR;
      fish.y = midY + Math.sin(angle) * spiralR;
      fish.velocityX = 0;
      fish.velocityY = 0;
      fish.rotation = 0;
      fish.targetRotation = 0;
      const goRight = -Math.sin(angle) >= 0;
      fish.flipScale = goRight ? 1 : -1;
      fish.targetFlipScale = fish.flipScale;
      partner.x = midX + Math.cos(angle + Math.PI) * spiralR;
      const pY = midY + Math.sin(angle + Math.PI) * spiralR;
      if (partner.baseY !== void 0) partner.baseY = pY;
      else partner.y = pY;
      partner.direction = goRight ? -1 : 1;
      partner.flipX = void 0;
      if (Math.random() < 0.04 + ease * 0.18) spawnHeart();
    }
    if (t >= 1) {
      danceState.danceStep++;
      danceState.stepStartTime = null;
      return danceState.danceStep >= steps.length;
    }
    return false;
  }
  function updateMatingDance(danceState, fish, partner, deltaTime, width, height, updateRotationAndAnimation2, spawnHeart, currentTime) {
    if (!partner) return { ...danceState, completed: true };
    if (partner.isDying) {
      if (partner.isDancing) {
        partner.isDancing = false;
        delete partner.flipX;
      }
      return { ...danceState, completed: true };
    }
    const partnerY = partner.baseY !== void 0 ? partner.baseY : partner.y;
    if (danceState.phase === 0) {
      const targetDistance = (fish.currentSize + partner.size) * 0.9;
      const dx = partner.x - fish.x;
      const dy = partnerY - fish.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      danceState._approachMax = danceState._approachMax || Math.max(dist, 300);
      danceState.progress = Math.min(0.22, (1 - dist / danceState._approachMax) * 0.22);
      if (dist > targetDistance) {
        const speed = 2.5;
        const nx = dx / dist;
        const ny = dy / dist;
        fish.velocityX = nx * speed;
        fish.velocityY = ny * speed;
        fish.x += fish.velocityX;
        fish.y += fish.velocityY;
        partner.x -= nx * speed * 1.3;
        if (partner.baseY !== void 0) partner.baseY -= ny * speed * 1.3;
        else partner.y -= ny * speed * 1.3;
        partner.age = (partner.age || 0) + deltaTime;
        const angleToPartner = Math.atan2(dy, dx);
        fish.targetFlipScale = Math.abs(angleToPartner) > Math.PI / 2 ? -1 : 1;
        fish.targetRotation = fish.targetFlipScale === 1 ? angleToPartner : Math.PI - angleToPartner;
        const angleToUs = Math.atan2(-dy, -dx);
        partner.direction = angleToUs > -Math.PI / 2 && angleToUs < Math.PI / 2 ? 1 : -1;
        updateRotationAndAnimation2(deltaTime);
        if (Math.random() < 0.02) spawnHeart();
      } else {
        fish.velocityX = 0;
        fish.velocityY = 0;
        fish.targetRotation = 0;
        fish.rotation = 0;
        danceState.phase = 1;
        danceState.danceStep = 0;
        danceState.danceSteps = _buildDanceSteps();
        danceState.stepStartTime = null;
        danceState.progress = 0.22;
      }
    } else if (danceState.phase === 1) {
      const totalSteps = danceState.danceSteps ? danceState.danceSteps.length : 1;
      const done = _stepDanceChoreography(danceState, fish, partner, deltaTime, currentTime, spawnHeart);
      if (done) {
        delete partner.flipX;
        danceState.phase = 2;
        danceState.kissStartTime = currentTime;
        danceState.bigHeart = null;
        danceState.progress = 0.7;
      } else {
        const step = danceState.danceStep;
        const stepDur = danceState.danceSteps[step].duration;
        const stepT = danceState.stepStartTime ? Math.min((currentTime - danceState.stepStartTime) / stepDur, 1) : 0;
        danceState.progress = 0.22 + (step + stepT) / totalSteps * 0.48;
      }
    } else if (danceState.phase === 2) {
      const kissTime = currentTime - danceState.kissStartTime;
      const kissDuration = 2e3;
      danceState.progress = 0.7 + Math.min(kissTime / kissDuration, 1) * 0.3;
      if (kissTime < kissDuration) {
        const midX = (fish.x + partner.x) / 2;
        const midY = (fish.y + (partner.baseY !== void 0 ? partner.baseY : partner.y)) / 2;
        if (!danceState.bigHeart) {
          danceState.bigHeart = {
            x: midX,
            y: midY,
            size: 0,
            targetSize: Math.max(fish.currentSize, partner.size) * 1.5,
            opacity: 0
          };
        }
        if (kissTime < 500) {
          const p = kissTime / 500;
          danceState.bigHeart.size = danceState.bigHeart.targetSize * p;
          danceState.bigHeart.opacity = p;
        } else if (kissTime < 1500) {
          danceState.bigHeart.size = danceState.bigHeart.targetSize;
          danceState.bigHeart.opacity = 1;
          danceState.bigHeart.x = midX;
          danceState.bigHeart.y = midY;
        } else {
          danceState.bigHeart.opacity = 1 - (kissTime - 1500) / 500;
        }
        if (Math.random() < 0.06) spawnHeart();
      } else {
        danceState.phase = 3;
        danceState.progress = 1;
      }
    } else if (danceState.phase === 3) {
      danceState.progress = 1;
      danceState.completed = true;
    }
    return danceState;
  }
  function completeMatingDance(fish, partner, width, height, fishLayer, spawnBabyFish2) {
    partner.isDancing = false;
    const spawnX = (fish.x + partner.x) / 2;
    const spawnY = (fish.y + (partner.baseY !== void 0 ? partner.baseY : partner.y)) / 2;
    const soloSchoolId = `solo_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    partner.schoolId = soloSchoolId;
    partner.isIndependent = true;
    partner.isBeingAttacked = false;
    partner.passive = true;
    partner.bornAt = performance.now();
    partner.speed = Math.max(0.4, (partner.speed || 0.6) * 0.8);
    const babySchoolId = `family_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const babyDirection = partner.direction;
    spawnBabyFish2(width, height, spawnX, spawnY, { promoteNewCurious: false, schoolId: babySchoolId, direction: babyDirection });
    fish.velocityX = 0;
    fish.velocityY = 0;
    return {
      completed: true,
      hasReproduced: true
    };
  }
  function spawnBabyFish(width, height, spawnX, spawnY, fishLayer, options = {}, config) {
    const babyCount = 3 + Math.floor(Math.random() * 3);
    if (!fishLayer) return 0;
    const MAX_FISH = 150;
    if (fishLayer.sharks && fishLayer.sharks.length >= MAX_FISH) return 0;
    const curiousFishImage = fishLayer.fishImages && fishLayer.fishImages[3];
    const promoteNewCurious = !!options.promoteNewCurious;
    const providedSchoolId = options.schoolId;
    const providedDirection = options.direction;
    for (let i = 0; i < babyCount; i++) {
      const burstAngle = Math.random() * Math.PI * 2;
      const burstSpeed = 2.5 + Math.random() * 2;
      const baby = {
        x: spawnX,
        baseY: spawnY,
        y: 0,
        direction: typeof providedDirection !== "undefined" ? providedDirection : Math.random() > 0.5 ? 1 : -1,
        speed: 0.3 + Math.random() * 0.3,
        baseSpeed: 0.3 + Math.random() * 0.3,
        size: 20,
        burstVX: Math.cos(burstAngle) * burstSpeed,
        burstVY: Math.sin(burstAngle) * burstSpeed,
        age: 0,
        schoolWavePhase: Math.random() * Math.PI * 2,
        schoolWaveSpeed: 1e-3 + Math.random() * 5e-4,
        schoolWaveAmplitude: 8 + Math.random() * 4,
        verticalPeriod: 3e3 + Math.random() * 2e3,
        verticalAmplitude: 3 + Math.random() * 3,
        depthTier: 3,
        image: curiousFishImage,
        _imageIndex: 3,
        // fishImages[3] = curiousfish.webp — O(1) lookup in drawShark
        isDying: false,
        bornAt: performance.now()
        // for FishLayer lifespan culling
      };
      if (providedSchoolId) baby.schoolId = providedSchoolId;
      if (fishLayer?.sharks) {
        fishLayer.sharks.push(baby);
      }
    }
    if (promoteNewCurious && config) {
      const index = Math.floor(Math.random() * Math.min(babyCount, fishLayer.sharks.length));
      const promoted = fishLayer.sharks[index];
      if (promoted) {
        return {
          promoteToNewFish: true,
          x: promoted.x,
          y: promoted.baseY || promoted.y,
          size: config.size
        };
      }
    }
    return babyCount;
  }

  // assets/canvas/curious-fish/behaviors/AttackBehavior.js
  function updateSchoolFishAttack(fish, targetSchoolFish, fishLayer, onVictory, onDefeat, spawnHeart, onBlood, maxFishSize, currentTime) {
    const target = targetSchoolFish;
    const targetStillExists = fishLayer?.sharks?.includes(target);
    if (!targetStillExists) {
      return { attackComplete: true, shouldDie: false };
    }
    const targetY = target.baseY !== void 0 ? target.baseY : target.y;
    const targetX = target.x;
    const targetMutations = {};
    if (!target.isBeingAttacked) {
      targetMutations.isBeingAttacked = true;
      targetMutations.frozenX = targetX;
      targetMutations.frozenY = targetY;
    }
    const targetIsBigger = target.size > fish.currentSize * 1.2;
    const targetIsSlightlyBigger = target.size > fish.currentSize && !targetIsBigger;
    const dx = targetX - fish.x;
    const dy = targetY - fish.y;
    const distSq = dx * dx + dy * dy;
    const collisionDistance = (fish.currentSize + target.size) * 0.5;
    if (distSq < collisionDistance * collisionDistance) {
      if (onBlood) onBlood((fish.x + targetX) / 2, (fish.y + targetY) / 2, Math.atan2(dy, dx));
      targetMutations._hitFlashTime = currentTime;
      if (targetIsBigger) {
        targetMutations.isBeingAttacked = false;
        if (onDefeat) onDefeat();
        return { attackComplete: true, shouldDie: true, targetMutations };
      } else if (targetIsSlightlyBigger && Math.random() > 0.4) {
        targetMutations.isBeingAttacked = false;
        if (onDefeat) onDefeat();
        return { attackComplete: true, shouldDie: true, targetMutations };
      } else if (!target.isDying) {
        targetMutations.isDying = true;
        if (fishLayer?.boneLoaded && fishLayer.boneImage) targetMutations.image = fishLayer.boneImage;
        targetMutations.killedByCurious = true;
        targetMutations.deathRotation = 0;
        targetMutations.deathStartTime = currentTime;
        targetMutations.isBeingAttacked = false;
        if (onVictory) onVictory(target, Math.min(fish.targetSize * 1.04, maxFishSize));
        if (spawnHeart) spawnHeart();
      }
      return { attackComplete: true, shouldDie: false, targetMutations };
    }
    const attackSpeed = 13;
    const distance = Math.sqrt(distSq);
    const velocityX = dx / distance * attackSpeed;
    const velocityY = dy / distance * attackSpeed;
    const angleToTarget = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    if (angleToTarget > Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = Math.PI - angleToTarget;
    } else if (angleToTarget < -Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = -Math.PI - angleToTarget;
    } else {
      targetFlipScale = 1;
      targetRotation = angleToTarget;
    }
    return { attackComplete: false, shouldDie: false, velocityX, velocityY, targetFlipScale, targetRotation, targetMutations };
  }

  // assets/canvas/curious-fish/behaviors/MovementBehavior.js
  function updateForcedTarget(fish, forcedTarget) {
    const dx = forcedTarget.x - fish.x;
    const dy = forcedTarget.y - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tol = typeof forcedTarget.tolerance === "number" ? forcedTarget.tolerance : 6;
    const speed = typeof forcedTarget.speed === "number" ? forcedTarget.speed : 2;
    if (dist <= tol) {
      return {
        isComplete: true,
        velocityX: 0,
        velocityY: 0
      };
    }
    const velocityX = dx / dist * speed;
    const velocityY = dy / dist * speed;
    const angle = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    if (angle > Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = Math.PI - angle;
    } else if (angle < -Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = -Math.PI - angle;
    } else {
      targetFlipScale = 1;
      targetRotation = angle;
    }
    return {
      isComplete: false,
      velocityX,
      velocityY,
      targetRotation,
      targetFlipScale
    };
  }
  function findFoodTarget(fish, foodParticles, width, height, followDistance, fovMultiplier, FISH_SIZE_FACTORS3) {
    const mouthDistance = fish.currentSize * FISH_SIZE_FACTORS3.MOUTH_DISTANCE;
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
    const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
    const mouthRadius = fish.currentSize * FISH_SIZE_FACTORS3.MOUTH_RADIUS;
    const fovOriginDistance = fish.currentSize * FISH_SIZE_FACTORS3.FOV_ORIGIN_DISTANCE;
    const fovOriginX = fish.x + Math.cos(fish.rotation) * fovOriginDistance * fish.flipScale;
    const fovOriginY = fish.y + Math.sin(fish.rotation) * fovOriginDistance;
    const viewportBase = typeof window !== "undefined" && window.innerWidth ? window.innerWidth * 0.2 : 800 * 0.2;
    const minBySize = fish.currentSize * 1.5;
    const fovBase = Math.max(viewportBase, minBySize);
    const fovDistance = fovBase * fovMultiplier;
    const fovAngle = Math.PI / 2;
    const fishDirection = fish.flipScale > 0 ? fish.rotation : Math.PI - fish.rotation;
    const eatenFood = [];
    const foodUpdates = [];
    let newTargetedFood = fish.targetedFood;
    let shouldFindNewFood = true;
    if (fish.targetedFood) {
      const targeted = fish.targetedFood;
      if (!targeted.eaten) {
        const tdx = targeted.x - fovOriginX;
        const tdy = targeted.y - fovOriginY;
        const tdistSquared = tdx * tdx + tdy * tdy;
        const centerDx = targeted.x - fish.x;
        const centerDy = targeted.y - fish.y;
        const centerDistSquared = centerDx * centerDx + centerDy * centerDy;
        const minCenterDistanceSquared = (fish.currentSize * 1.2) ** 2;
        if (centerDistSquared < minCenterDistanceSquared) {
          newTargetedFood = null;
        } else if (tdistSquared <= fovDistance * fovDistance && targeted.y <= height * 0.9) {
          shouldFindNewFood = false;
          foodUpdates.push({ food: targeted, updates: { isTargeted: true } });
        } else {
          newTargetedFood = null;
        }
      } else {
        newTargetedFood = null;
      }
    }
    for (const food of foodParticles) {
      if (food.eaten) continue;
      const mouthDx = food.x - mouthX;
      const mouthDy = food.y - mouthY;
      const mouthDistSquared = mouthDx * mouthDx + mouthDy * mouthDy;
      if (mouthDistSquared < mouthRadius * mouthRadius) {
        foodUpdates.push({ food, updates: { eaten: true } });
        eatenFood.push(food);
        if (fish.targetedFood === food) {
          newTargetedFood = null;
          shouldFindNewFood = true;
        }
      }
    }
    if (shouldFindNewFood) {
      const bottomThreshold = height * 0.9;
      let nearestFood = null;
      let nearestDistanceSquared = fovDistance * fovDistance;
      for (const food of foodParticles) {
        if (food.eaten || food.y > bottomThreshold) continue;
        const foodDeltaX = food.x - fovOriginX;
        const foodDeltaY = food.y - fovOriginY;
        const foodDistanceSquared = foodDeltaX * foodDeltaX + foodDeltaY * foodDeltaY;
        const centerDx = food.x - fish.x;
        const centerDy = food.y - fish.y;
        const centerDistSquared = centerDx * centerDx + centerDy * centerDy;
        const minCenterDistanceSquared = (fish.currentSize * FISH_SIZE_FACTORS3.MIN_CENTER_DISTANCE) ** 2;
        if (centerDistSquared < minCenterDistanceSquared || foodDistanceSquared > fovDistance * fovDistance) continue;
        const angleToFood = Math.atan2(foodDeltaY, foodDeltaX);
        let angleDiff = angleToFood - fishDirection;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const isInCone = Math.abs(angleDiff) < fovAngle / 2;
        if (isInCone && foodDistanceSquared < nearestDistanceSquared) {
          nearestDistanceSquared = foodDistanceSquared;
          nearestFood = food;
        }
      }
      if (nearestFood) {
        newTargetedFood = nearestFood;
        foodUpdates.push({ food: nearestFood, updates: { isTargeted: true } });
      }
    }
    const foodToChase = newTargetedFood;
    if (foodToChase && !foodToChase.eaten) {
      foodUpdates.push({ food: foodToChase, updates: { isTargeted: true } });
    }
    return {
      targetFood: foodToChase,
      eatenFood,
      mutations: {
        targetedFood: newTargetedFood,
        foodUpdates
      }
    };
  }
  function calculateMovement(fish, targetX, targetY, mouseX, mouseY, targetIsFood, maxSpeed, maxFishSize, followDistance, deltaTime, FISH_SIZE_FACTORS3) {
    if (targetX === null || targetY === null) {
      return {
        velocityX: fish.velocityX * 0.95,
        velocityY: fish.velocityY * 0.95,
        isStaring: false
      };
    }
    const dx = targetX - fish.x;
    const dy = targetY - fish.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angleToMouse = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    if (angleToMouse > Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = Math.PI - angleToMouse;
    } else if (angleToMouse < -Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = -Math.PI - angleToMouse;
    } else {
      targetFlipScale = 1;
      targetRotation = angleToMouse;
    }
    const mouthDistance = fish.currentSize * FISH_SIZE_FACTORS3.MOUTH_DISTANCE;
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
    const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
    const mouthToCursorDx = mouseX - mouthX;
    const mouthToCursorDy = mouseY - mouthY;
    const mouthDistance_cursor = Math.sqrt(mouthToCursorDx * mouthToCursorDx + mouthToCursorDy * mouthToCursorDy);
    const effectiveFollowDistance = Math.min(
      fish.currentSize * FISH_SIZE_FACTORS3.FOLLOW_DISTANCE * followDistance,
      150
    );
    let isFleeing = fish.isFleeing;
    let fleeTimer = fish.fleeTimer || 0;
    let isStaring = false;
    let velocityX = fish.velocityX;
    let velocityY = fish.velocityY;
    if (!targetIsFood && distance < fish.currentSize * FISH_SIZE_FACTORS3.COLLISION_THRESHOLD && !isFleeing) {
      isFleeing = true;
      fleeTimer = 0;
    }
    if (isFleeing) {
      fleeTimer += deltaTime;
      const swimDirection = fish.rotation;
      const fleeSpeed = maxSpeed * 1.5;
      velocityX = Math.cos(swimDirection) * fleeSpeed * fish.flipScale;
      velocityY = Math.sin(swimDirection) * fleeSpeed;
      let angleAwayFromCursor = Math.atan2(dy, dx) + Math.PI;
      if (angleAwayFromCursor > Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = Math.PI - angleAwayFromCursor;
      } else if (angleAwayFromCursor < -Math.PI / 2) {
        targetFlipScale = -1;
        targetRotation = -Math.PI - angleAwayFromCursor;
      } else {
        targetFlipScale = 1;
        targetRotation = angleAwayFromCursor;
      }
      if (fleeTimer > 600 || distance > effectiveFollowDistance * 1.5) {
        isFleeing = false;
      }
    } else if (targetIsFood) {
      const sizeRatio = fish.currentSize / maxFishSize;
      const speedMultiplier = 1.1 - sizeRatio * 0.2;
      const adjustedSpeed = maxSpeed * speedMultiplier;
      const targetVelX = dx / distance * adjustedSpeed;
      const targetVelY = dy / distance * adjustedSpeed;
      velocityX += (targetVelX - velocityX) * 0.22;
      velocityY += (targetVelY - velocityY) * 0.22;
    } else if (mouthDistance_cursor > effectiveFollowDistance) {
      const maxDistance = 500;
      const distanceRatio = Math.min(distance / maxDistance, 1);
      const sizeRatio = fish.currentSize / maxFishSize;
      const sizeSpeedMultiplier = 1.1 - sizeRatio * 0.2;
      const dynamicSpeed = maxSpeed * (0.4 + distanceRatio * distanceRatio * 0.6) * sizeSpeedMultiplier;
      const targetVelX = dx / distance * dynamicSpeed;
      const targetVelY = dy / distance * dynamicSpeed;
      velocityX += (targetVelX - velocityX) * 0.22;
      velocityY += (targetVelY - velocityY) * 0.22;
    } else {
      isStaring = true;
      velocityX *= 0.9;
      velocityY *= 0.9;
    }
    return {
      velocityX,
      velocityY,
      targetRotation,
      targetFlipScale,
      isFleeing,
      isStaring,
      fleeTimer
    };
  }
  function clampPosition(fish, width, height, size, isSwimmingAway) {
    if (isSwimmingAway) {
      return { x: fish.x, y: fish.y };
    }
    let x = Math.max(size, Math.min(width - size, fish.x));
    let y = fish.y;
    if (y <= height) {
      y = Math.max(height * 0.1, Math.min(height, y));
    }
    return { x, y };
  }
  function updateRotationAndAnimation(fish, deltaTime, rotationSpeed, maxFishSize) {
    let rotationDiff = fish.targetRotation - fish.rotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    const sizeRatio = fish.currentSize / maxFishSize;
    const rotationMultiplier = 1.2 - sizeRatio * 0.3;
    const rotation = fish.rotation + rotationDiff * rotationSpeed * rotationMultiplier;
    const flipDiff = fish.targetFlipScale - fish.flipScale;
    const flipScale = fish.flipScale + flipDiff * 0.2;
    const age = fish.age + deltaTime;
    const swimPhase = age / 800 % 1;
    return {
      rotation,
      flipScale,
      age,
      swimPhase
    };
  }
  function setTargetPoint(fish, x, y, opts = {}, maxSpeed) {
    const immediate = !!opts.immediate;
    const hold = !!opts.hold;
    const dx = x - fish.x;
    const dy = y - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
      return null;
    }
    const angle = Math.atan2(dy, dx);
    let targetFlipScale, targetRotation;
    if (angle > Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = Math.PI - angle;
    } else if (angle < -Math.PI / 2) {
      targetFlipScale = -1;
      targetRotation = -Math.PI - angle;
    } else {
      targetFlipScale = 1;
      targetRotation = angle;
    }
    const baseSpeed = typeof opts.speed === "number" ? opts.speed : maxSpeed || 2;
    if (hold) {
      const forcedTarget = {
        x: Math.round(x),
        y: Math.round(y),
        speed: baseSpeed,
        tolerance: typeof opts.tolerance === "number" ? opts.tolerance : 6
      };
      const velocityX = dx / dist * baseSpeed;
      const velocityY = dy / dist * baseSpeed;
      return {
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale,
        forcedTarget
      };
    } else if (immediate) {
      const velocityX = dx / dist * baseSpeed;
      const velocityY = dy / dist * baseSpeed;
      return {
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
      };
    } else {
      const targetVelX = dx / dist * (baseSpeed * 0.6);
      const targetVelY = dy / dist * (baseSpeed * 0.6);
      const velocityX = fish.velocityX + (targetVelX - fish.velocityX) * 0.12;
      const velocityY = fish.velocityY + (targetVelY - fish.velocityY) * 0.12;
      return {
        velocityX,
        velocityY,
        targetRotation,
        targetFlipScale
      };
    }
  }

  // assets/canvas/curious-fish/render/CuriousFishRenderer.js
  var FISH_SIZE_FACTORS = {
    FOLLOW_DISTANCE: 0.5,
    MOUTH_DISTANCE: 0.9,
    MOUTH_RADIUS: 0.3,
    FOV_ORIGIN_DISTANCE: 0.3,
    COLLISION_THRESHOLD: 0.5,
    NEAR_MOUSE_THRESHOLD: 0.8,
    MIN_CENTER_DISTANCE: 1.2
  };
  function drawFish(ctx, fish, fishImage, config, isAttackingSchoolFish, targetSchoolFish, width, height) {
    if (fish && fish.hidden) return;
    const currentSpeed = Math.sqrt(fish.velocityX * fish.velocityX + fish.velocityY * fish.velocityY);
    const maxSpeed = config.maxSpeed;
    const speedRatio = Math.min(currentSpeed / maxSpeed, 1);
    const sizeScale = fish.currentSize / 30;
    const bobFrequency = 8e-4 / Math.sqrt(sizeScale);
    const fadeThreshold = 0.5;
    const fadeStart = 0.1;
    const fadeAmount = speedRatio < fadeStart ? 1 : speedRatio > fadeThreshold ? 0 : 1 - (speedRatio - fadeStart) / (fadeThreshold - fadeStart);
    const bobActive = config.enableBob ? fadeAmount : 0;
    const verticalBob = bobActive * Math.sin(fish.age * bobFrequency) * 6 * sizeScale;
    const rotationBob = bobActive * Math.sin(fish.age * bobFrequency * 0.7) * 0.05;
    ctx.save();
    ctx.translate(fish.x, fish.y + verticalBob);
    ctx.scale(fish.flipScale, 1);
    ctx.rotate(fish.rotation + rotationBob);
    ctx.globalAlpha = 1;
    const size = fish.currentSize;
    const imgWidth = size * 2;
    const imgHeight = size * (fishImage.height / fishImage.width) * 2;
    ctx.drawImage(fishImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();
    if (config.showDebug) {
      drawFishDebug(ctx, fish, config, isAttackingSchoolFish, targetSchoolFish, width, height);
    }
  }
  function drawFishDebug(ctx, fish, config, isAttackingSchoolFish, targetSchoolFish, width, height) {
    const mouthDistance = fish.currentSize * 0.9;
    ctx.save();
    const mouthX = fish.x + Math.cos(fish.rotation) * mouthDistance * fish.flipScale;
    const mouthY = fish.y + Math.sin(fish.rotation) * mouthDistance;
    const mouthRadius = fish.currentSize * 0.3;
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, mouthRadius, 0, Math.PI * 2);
    ctx.stroke();
    const effectiveFollowDistance = Math.min(
      fish.currentSize * FISH_SIZE_FACTORS.FOLLOW_DISTANCE * config.followDistance,
      150
    );
    ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, effectiveFollowDistance, 0, Math.PI * 2);
    ctx.stroke();
    const cfSize = fish.currentSize;
    const avoidRadius = 100 + cfSize;
    ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(fish.x, fish.y, avoidRadius * 0.87, avoidRadius * 0.4, fish.rotation, 0, Math.PI * 2);
    ctx.stroke();
    if (isAttackingSchoolFish && targetSchoolFish) {
      const collisionDistance = (fish.currentSize + targetSchoolFish.size) * 0.5;
      ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(fish.x, fish.y, collisionDistance * 0.87, collisionDistance * 0.4, fish.rotation, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 0, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(fish.x, fish.y);
      ctx.lineTo(targetSchoolFish.x, targetSchoolFish.baseY || targetSchoolFish.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "rgba(255, 128, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fish.x, fish.y, fish.currentSize * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.round(fish.currentSize)}px`, fish.x + fish.currentSize, fish.y - fish.currentSize - 10);
    const fovOriginDistance = fish.currentSize * 0.3;
    const fovOriginX = fish.x + Math.cos(fish.rotation) * fovOriginDistance * fish.flipScale;
    const fovOriginY = fish.y + Math.sin(fish.rotation) * fovOriginDistance;
    const viewportBaseDraw = typeof window !== "undefined" && window.innerWidth ? window.innerWidth * 0.2 : 800 * 0.2;
    const minBySizeDraw = fish.currentSize * 1.5;
    const fovBaseDraw = Math.max(viewportBaseDraw, minBySizeDraw);
    const fovMultiplierDraw = config && config.fovMultiplier !== void 0 ? config.fovMultiplier : 1;
    const fovDistance = fovBaseDraw * fovMultiplierDraw;
    const fovAngle = Math.PI / 2;
    const fishDirection = fish.flipScale > 0 ? fish.rotation : Math.PI - fish.rotation;
    ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fovOriginX, fovOriginY);
    const leftAngle = fishDirection - fovAngle / 2;
    const leftX = fovOriginX + Math.cos(leftAngle) * fovDistance;
    const leftY = fovOriginY + Math.sin(leftAngle) * fovDistance;
    ctx.lineTo(leftX, leftY);
    ctx.arc(fovOriginX, fovOriginY, fovDistance, leftAngle, fishDirection + fovAngle / 2);
    ctx.lineTo(fovOriginX, fovOriginY);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const bottomThreshold = height * 0.9;
    ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
    ctx.fillRect(0, bottomThreshold, width, height - bottomThreshold);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bottomThreshold);
    ctx.lineTo(width, bottomThreshold);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Dead zone (10vh)", width - 10, bottomThreshold - 5);
  }

  // assets/canvas/layers/CuriousFishLayer.js
  var FISH_SIZE_FACTORS2 = {
    // Detection and interaction ranges
    MOUTH_DISTANCE: 0.9,
    // Distance from center to mouth (90% of size)
    MOUTH_RADIUS: 0.3,
    // Radius of mouth area (30% of size)
    FOV_ORIGIN_DISTANCE: 0.3,
    // Field of view origin offset
    FOLLOW_DISTANCE: 0.5,
    // Base follow distance multiplier
    // Attack and collision thresholds
    COLLISION_THRESHOLD: 0.5,
    // Distance to consider collision (50% of size)
    NEAR_MOUSE_THRESHOLD: 0.8,
    // Distance to consider near mouse cursor
    // Minimum distance thresholds
    MIN_CENTER_DISTANCE: 1.2
    // Minimum distance factor from center to food
  };
  var ICON_SPAWN_CONFIG = {
    default: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    heart: { distanceFactor: 0.45, sizeFactor: 0.1, yOffset: -25, maxAge: 800, velocityRange: 0.2 },
    lightning: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1e3, velocityRange: 0.15 },
    food: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1e3, velocityRange: 0.15 },
    star: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    bubble: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.15 },
    zzz: { distanceFactor: 0.3, sizeFactor: 0.15, yOffset: -35, maxAge: 1200, velocityRange: 0.1 },
    question: { distanceFactor: 0.3, sizeFactor: 0.12, yOffset: -30, maxAge: 1e3, velocityRange: 0.15 },
    exclamation: { distanceFactor: 0.3, sizeFactor: 0.14, yOffset: -30, maxAge: 900, velocityRange: 0.2 }
  };
  var CuriousFishLayer = class _CuriousFishLayer {
    // Single source of truth for curious fish configuration
    static DEFAULT_CONFIG = {
      speed: 5,
      maxSpeed: 6,
      size: 20,
      maxFishSize: 150,
      followDistance: 50,
      rotationSpeed: 0.12,
      heartSpawnRate: 500,
      imageSrc: "assets/images/fish/curiousfish.webp",
      showDebug: false,
      swimAwaySpeed: 3,
      enableBob: true
    };
    /**
     * Create a CuriousFishLayer
     * @param {Object} options - Configuration options
     * @param {number} [options.speed=5.0] - Fish movement speed
     * @param {number} [options.size=30] - Initial fish size
     * @param {number} [options.maxFishSize=150] - Maximum fish size
     */
    constructor(options = {}) {
      this.enabled = false;
      this.fish = null;
      this.mouseX = null;
      this.mouseY = null;
      this.hearts = [];
      this.isStaring = false;
      this.heartSpawnTimer = 0;
      this.manager = null;
      this.lastMouseMoveTime = performance.now();
      this.newFish = null;
      this.targetSchoolFish = null;
      this.isAttackingSchoolFish = false;
      this.lastAttackTime = 0;
      this.attackCooldown = 2e3;
      this.fishImage = new Image();
      this.imageLoaded = false;
      this.gameState = "idle";
      this.danceState = null;
      this.dancePartner = null;
      this.config = {
        ..._CuriousFishLayer.DEFAULT_CONFIG,
        ...options
      };
      this.fishImage.onload = () => {
        this.imageLoaded = true;
        this._fishDepthCache = this._buildDepthCache(this.fishImage);
        console.log("Curious fish image loaded");
      };
      this.fishImage.onerror = () => {
        console.error("Failed to load curious fish image:", this.config.imageSrc);
        this.imageLoaded = false;
      };
      this.fishImage.src = this.config.imageSrc;
      this.allFish = [];
      this.boneImage = new Image();
      this.boneLoaded = false;
      this.boneImage.onload = () => {
        this.boneLoaded = true;
        console.log("Fishbone image loaded");
      };
      this.boneImage.onerror = () => {
        console.warn("Failed to load fishbone image at assets/images/fish/fishbone.webp");
      };
      this.boneImage.src = "assets/images/fish/fishbone.webp";
      this.skeletons = [];
      this._fishDepthCache = null;
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
    }
    init(width, height, canvasManager) {
      this.width = width;
      this.height = height;
      this.manager = canvasManager;
      this.spawnFish();
      if (typeof window !== "undefined") {
        window.curiousFishLayer = this;
        window.setCuriousTarget = (x, y, opts) => {
          try {
            this.setTargetPoint(x, y, opts || {});
          } catch (e) {
            console.error(e);
          }
        };
      }
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("touchmove", this.handleTouchMove, { passive: true });
      console.log("CuriousFishLayer initialized");
    }
    handleMouseMove(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.lastMouseMoveTime = Date.now();
    }
    handleTouchMove(e) {
      if (e.touches.length === 0) return;
      this.mouseX = e.touches[0].clientX;
      this.mouseY = e.touches[0].clientY;
      this.lastMouseMoveTime = Date.now();
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
    }
    render(ctx, currentTime, deltaTime, width, height) {
      if (!this.enabled || !this.fish) return;
      if (this.fish.isDying) {
        if (!this.fish.skeletonSpawned) {
          this.fish.skeletonSpawned = true;
          this.skeletons.push({
            x: this.fish.x,
            y: this.fish.y,
            vx: (this.fish.velocityX || 0) / 16,
            // px/ms
            vy: (this.fish.velocityY || 0) / 16,
            flipScale: this.fish.flipScale,
            size: this.fish.currentSize,
            startTime: Date.now(),
            lastUpdate: Date.now()
          });
          const fishLayer = this.manager && this.manager.getLayer("fish");
          if (fishLayer && fishLayer._spawnBloodBurst) {
            fishLayer._spawnBloodBurst(this.fish.x, this.fish.y, this.fish.currentSize, null);
          }
        }
        this.drawSkeletons(ctx, height);
        return;
      }
      if (this.skeletons.length > 0) {
        this.drawSkeletons(ctx, height);
      }
      if (!this.imageLoaded) return;
      if (this.danceState) {
        this.updateDance(deltaTime, width, height);
        this.fish.age += deltaTime;
        this.fish.swimPhase = this.fish.age / 500 % 1;
        this.drawFish(ctx);
        if (this.danceState && this.danceState.phase === 2 && this.danceState.bigHeart) {
          ctx.save();
          ctx.globalAlpha = this.danceState.bigHeart.opacity;
          ctx.fillStyle = "#ff69b4";
          ctx.font = `${this.danceState.bigHeart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "#ff69b4";
          ctx.shadowBlur = 30;
          ctx.fillText("\u2764\uFE0F", this.danceState.bigHeart.x, this.danceState.bigHeart.y);
          ctx.restore();
        }
        this.updateHearts(deltaTime);
        this.drawHearts(ctx);
        return;
      }
      const currentTimestamp = Date.now();
      let timeSinceMouseMove = currentTimestamp - this.lastMouseMoveTime;
      if (this._forcedTarget && !this.fish.isDying) {
        const forcedResult = updateForcedTarget(this.fish, this._forcedTarget);
        if (forcedResult.isComplete) {
          delete this._forcedTarget;
          this.fish.velocityX = 0;
          this.fish.velocityY = 0;
        } else {
          this.fish.velocityX = forcedResult.velocityX;
          this.fish.velocityY = forcedResult.velocityY;
          this.fish.targetFlipScale = forcedResult.targetFlipScale;
          this.fish.targetRotation = forcedResult.targetRotation;
          this.updateRotationAndAnimation(deltaTime);
          this.fish.x += this.fish.velocityX;
          this.fish.y += this.fish.velocityY;
          this.drawFish(ctx);
          this.updateHearts(deltaTime);
          this.drawHearts(ctx);
          return;
        }
      }
      if (this.isAttackingSchoolFish && this.targetSchoolFish) {
        const fishLayer = this.manager && this.manager.getLayer("fish");
        const attackResult = updateSchoolFishAttack(
          this.fish,
          this.targetSchoolFish,
          fishLayer,
          (target, newTargetSize) => {
            this.fish.targetSize = newTargetSize;
          },
          () => {
            this.fish.isDying = true;
          },
          () => this.spawnHeart(),
          (bx, by, angle) => {
            if (fishLayer && fishLayer._spawnBloodBurst) {
              fishLayer._spawnBloodBurst(bx, by, (this.fish.currentSize + (this.targetSchoolFish?.size || 30)) * 0.5, angle);
            }
          },
          this.config.maxFishSize,
          currentTime
        );
        if (attackResult.targetMutations && this.targetSchoolFish) {
          Object.assign(this.targetSchoolFish, attackResult.targetMutations);
        }
        if (attackResult.attackComplete) {
          this.isAttackingSchoolFish = false;
          this.targetSchoolFish = null;
        } else if (attackResult.shouldDie) {
          this.isAttackingSchoolFish = false;
          this.targetSchoolFish = null;
        } else if (attackResult.velocityX !== void 0) {
          this.fish.velocityX = attackResult.velocityX;
          this.fish.velocityY = attackResult.velocityY;
          this.fish.targetFlipScale = attackResult.targetFlipScale;
          this.fish.targetRotation = attackResult.targetRotation;
          this.fish.x += this.fish.velocityX;
          this.fish.y += this.fish.velocityY;
          this.updateRotationAndAnimation(deltaTime);
          this.fish.glowColor = "rgba(255,50,50,0.6)";
          this.drawFish(ctx);
          this.updateHearts(deltaTime);
          this.drawHearts(ctx);
          return;
        }
      }
      let targetX = this.mouseX;
      let targetY = this.mouseY + 10;
      let targetIsFood = false;
      if (this.manager && this.manager.foodLayer && this.manager.foodLayer.getParticles().length > 0) {
        const foodResult = findFoodTarget(
          this.fish,
          this.manager.foodLayer.getParticles(),
          width,
          height,
          this.config.followDistance,
          this.config && this.config.fovMultiplier !== void 0 ? this.config.fovMultiplier : 1,
          FISH_SIZE_FACTORS2
        );
        this.fish.targetedFood = foodResult.mutations.targetedFood;
        for (const { food, updates } of foodResult.mutations.foodUpdates) {
          Object.assign(food, updates);
        }
        for (const eatenFood of foodResult.eatenFood) {
          this.fish.targetSize = Math.min(this.fish.targetSize * 1.015, this.config.maxFishSize);
          this.spawnHeart();
        }
        const foodToChase = foodResult.targetFood;
        if (foodToChase && !foodToChase.eaten) {
          targetX = foodToChase.x;
          targetY = foodToChase.y;
          targetIsFood = true;
        }
      }
      const movementResult = calculateMovement(
        this.fish,
        targetX,
        targetY,
        this.mouseX,
        this.mouseY,
        targetIsFood,
        this.config.maxSpeed,
        this.config.maxFishSize,
        this.config.followDistance,
        deltaTime,
        FISH_SIZE_FACTORS2
      );
      this.fish.velocityX = movementResult.velocityX;
      this.fish.velocityY = movementResult.velocityY;
      if (movementResult.targetRotation !== void 0) {
        this.fish.targetRotation = movementResult.targetRotation;
      }
      if (movementResult.targetFlipScale !== void 0) {
        this.fish.targetFlipScale = movementResult.targetFlipScale;
      }
      if (movementResult.isFleeing !== void 0) {
        this.fish.isFleeing = movementResult.isFleeing;
      }
      if (movementResult.fleeTimer !== void 0) {
        this.fish.fleeTimer = movementResult.fleeTimer;
      }
      this.isStaring = movementResult.isStaring || false;
      this.updateRotationAndAnimation(deltaTime);
      this.fish.x += this.fish.velocityX;
      this.fish.y += this.fish.velocityY;
      const clampedPos = clampPosition(
        this.fish,
        width,
        height,
        this.config.size,
        false
      );
      this.fish.x = clampedPos.x;
      this.fish.y = clampedPos.y;
      if (this.fish.currentSize !== this.fish.targetSize) {
        const sizeDiff = this.fish.targetSize - this.fish.currentSize;
        this.fish.currentSize += sizeDiff * 0.025;
        if (Math.abs(sizeDiff) < 0.1) {
          this.fish.currentSize = this.fish.targetSize;
        }
      }
      this.fish.age += deltaTime;
      this.fish.swimPhase = this.fish.age / 800 % 1;
      this.fish.glowColor = "rgba(100,200,255,0.4)";
      if (!this.isAttackingSchoolFish) {
        this.drawFish(ctx);
      }
      this.updateHearts(deltaTime);
      this.drawHearts(ctx);
      this.drawTargetingCrosshair(ctx);
    }
    updateRotationAndAnimation(deltaTime) {
      const result = updateRotationAndAnimation(
        this.fish,
        deltaTime,
        this.config.rotationSpeed,
        this.config.maxFishSize
      );
      this.fish.rotation = result.rotation;
      this.fish.flipScale = result.flipScale;
      this.fish.age = result.age;
      this.fish.swimPhase = result.swimPhase;
    }
    /**
     * Set a movement/target point for the curious fish.
     * Called by spawnFish and external managers. opts.immediate -> apply direct velocity.
     */
    setTargetPoint(x, y, opts = {}) {
      if (!this.fish) return;
      const result = setTargetPoint(
        this.fish,
        x,
        y,
        opts,
        this.config.maxSpeed
      );
      if (!result) return;
      this.fish.velocityX = result.velocityX;
      this.fish.velocityY = result.velocityY;
      this.fish.targetRotation = result.targetRotation;
      this.fish.targetFlipScale = result.targetFlipScale;
      if (result.forcedTarget) {
        this._forcedTarget = result.forcedTarget;
        this.isAttackingSchoolFish = false;
        this.fish.targetedFood = null;
      }
      if (!this.enabled) {
        this.enabled = true;
        if (opts.hold || opts.immediate) {
          console.log("CuriousFishLayer enabled by setTargetPoint");
        }
      }
    }
    /**
     * Spawn an icon/symbol near the fish
     * @param {string} type - Icon type (heart, lightning, food, star, bubble, zzz, question, exclamation)
     */
    spawnIcon(type) {
      const config = ICON_SPAWN_CONFIG[type] || ICON_SPAWN_CONFIG.default;
      const distance = this.fish.currentSize * config.distanceFactor;
      const iconX = this.fish.x + Math.cos(this.fish.rotation) * distance * this.fish.flipScale;
      const iconY = this.fish.y + Math.sin(this.fish.rotation) * distance + config.yOffset;
      const baseSize = this.fish.currentSize * config.sizeFactor;
      this.hearts.push({
        x: iconX,
        y: iconY,
        velocityX: (Math.random() - 0.5) * config.velocityRange,
        velocityY: -0.35 - Math.random() * 0.2,
        age: 0,
        maxAge: config.maxAge,
        size: baseSize + Math.random() * baseSize * 0.4,
        type
      });
    }
    // Legacy spawn functions - deprecated in favor of consolidated spawnIcon()
    /**
     * @deprecated Use spawnIcon('heart') instead
     */
    spawnHeart() {
      this.spawnIcon("heart");
    }
    /**
     * @deprecated Use spawnIcon('lightning') instead
     */
    spawnLightning() {
      this.spawnIcon("lightning");
    }
    /**
     * @deprecated Use spawnIcon('food') instead
     */
    spawnFoodIcon() {
      this.spawnIcon("food");
    }
    /**
     * @deprecated Use spawnIcon('star') instead
     */
    spawnStar() {
      this.spawnIcon("star");
    }
    /**
     * @deprecated Use spawnIcon('bubble') instead
     */
    spawnBubble() {
      this.spawnIcon("bubble");
    }
    /**
     * @deprecated Use spawnIcon('zzz') instead
     */
    spawnZzz() {
      this.spawnIcon("zzz");
    }
    /**
     * @deprecated Use spawnIcon('question') instead
     */
    spawnQuestionMark() {
      this.spawnIcon("question");
    }
    /**
     * @deprecated Use spawnIcon('exclamation') instead
     */
    spawnExclamationMark() {
      this.spawnIcon("exclamation");
    }
    updateHearts(deltaTime) {
      let w = 0;
      for (let i = 0; i < this.hearts.length; i++) {
        const heart = this.hearts[i];
        heart.age += deltaTime;
        heart.x += heart.velocityX;
        heart.y += heart.velocityY;
        if (heart.age < heart.maxAge) {
          this.hearts[w++] = heart;
        }
      }
      this.hearts.length = w;
    }
    drawTargetingCrosshair(ctx) {
      if (!this.fish) return;
      const canvas2 = document.querySelector("canvas");
      if (!canvas2 || this.mouseX === null || this.mouseY === null) return;
      const rect = canvas2.getBoundingClientRect();
      const mouseX = this.mouseX - rect.left;
      const mouseY = this.mouseY - rect.top;
      const fishLayer = this.manager && this.manager.getLayer("fish");
      if (!fishLayer || !fishLayer.sharks) return;
      let hoveredFish = null;
      for (const shark of fishLayer.sharks) {
        if (shark.isDying) continue;
        const sharkY = shark.baseY || shark.y;
        const dx = mouseX - shark.x;
        const dy = mouseY - sharkY;
        if (dx * dx + dy * dy < shark.size * shark.size) {
          hoveredFish = shark;
          break;
        }
      }
      if (!hoveredFish) return;
      const isSameSpecies = hoveredFish.image?.src?.includes("curiousfish.png");
      const cursorColor = isSameSpecies ? "#ff69b4" : "#ff0000";
      ctx.save();
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const diameter = 1.5 * fontSize;
      const innerRadius = diameter * 0.3;
      const outerRadius = diameter * 0.5;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouseX - outerRadius - 5, mouseY);
      ctx.lineTo(mouseX - innerRadius, mouseY);
      ctx.moveTo(mouseX + innerRadius, mouseY);
      ctx.lineTo(mouseX + outerRadius + 5, mouseY);
      ctx.moveTo(mouseX, mouseY - outerRadius - 5);
      ctx.lineTo(mouseX, mouseY - innerRadius);
      ctx.moveTo(mouseX, mouseY + innerRadius);
      ctx.lineTo(mouseX, mouseY + outerRadius + 5);
      ctx.stroke();
      ctx.fillStyle = cursorColor;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawHearts(ctx) {
      ctx.save();
      for (const heart of this.hearts) {
        const ageRatio = heart.age / heart.maxAge;
        const opacity = 1 - ageRatio;
        ctx.globalAlpha = opacity;
        if (heart.type === "star") {
          ctx.fillStyle = "#ffdd00";
          ctx.font = `${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u2B50", heart.x, heart.y);
        } else if (heart.type === "bubble") {
          ctx.fillStyle = "rgba(100, 200, 255, 0.6)";
          ctx.strokeStyle = "rgba(150, 220, 255, 0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(heart.x, heart.y, heart.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (heart.type === "zzz") {
          ctx.fillStyle = "#cccccc";
          ctx.font = `${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Z", heart.x, heart.y);
        } else if (heart.type === "lightning") {
          ctx.fillStyle = "#ffff00";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.font = `bold ${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText("\u26A1", heart.x, heart.y);
          ctx.fillText("\u26A1", heart.x, heart.y);
        } else if (heart.type === "food") {
          ctx.fillStyle = "#ff6b6b";
          ctx.font = `${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u{1F34E}", heart.x, heart.y);
        } else if (heart.type === "question") {
          ctx.fillStyle = "#ffaa00";
          ctx.font = `bold ${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", heart.x, heart.y);
        } else if (heart.type === "exclamation") {
          ctx.fillStyle = "#ff0000";
          ctx.font = `bold ${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("!", heart.x, heart.y);
        } else {
          ctx.fillStyle = "#ff69b4";
          ctx.font = `${heart.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u2764\uFE0F", heart.x, heart.y);
        }
      }
      ctx.restore();
    }
    drawFish(ctx) {
      if (!this.imageLoaded || this.fishImage.naturalWidth === 0) return;
      const depthImage = this._fishDepthCache ? this._fishDepthCache[3] : this.fishImage;
      drawFish(
        ctx,
        this.fish,
        depthImage,
        this.config,
        this.isAttackingSchoolFish,
        this.targetSchoolFish,
        this.width,
        this.height
      );
    }
    startDance(partner) {
      this.danceState = initiateMatingDance(this.fish, partner);
      this.dancePartner = partner;
    }
    updateDance(deltaTime, width, height) {
      if (!this.danceState || !this.dancePartner) return;
      const result = updateMatingDance(
        this.danceState,
        this.fish,
        this.dancePartner,
        deltaTime,
        width,
        height,
        (dt) => this.updateRotationAndAnimation(dt),
        () => this.spawnHeart(),
        performance.now()
      );
      this.danceState = result;
      if (result.completed) {
        const fishLayer = this.manager && this.manager.getLayer("fish");
        if (fishLayer && this.dancePartner && !this.dancePartner.isDying) {
          completeMatingDance(
            this.fish,
            this.dancePartner,
            width,
            height,
            fishLayer,
            (w, h, x, y, options, cfg) => spawnBabyFish(w, h, x, y, fishLayer, options, cfg)
          );
          this.fish.velocityX = 0;
          this.fish.velocityY = 0;
          this.danceState = null;
          this.dancePartner = null;
        }
      }
    }
    spawnBabyFish(width, height, spawnX, spawnY, options = {}) {
      const fishLayer = this.manager && this.manager.getLayer("fish");
      if (!fishLayer) return;
      return spawnBabyFish(
        width,
        height,
        spawnX,
        spawnY,
        fishLayer,
        options,
        this.config
      );
    }
    /**
     * Spawn the curious fish at bottom-center with initial upward velocity.
     * No parameters — uses this.width/this.height (or window) and last mouse pos.
     * Fish will "soft" swim toward last mouse position (if available) via setTargetPoint.
     */
    spawnFish() {
      const width = this.width || (typeof window !== "undefined" ? window.innerWidth : 800);
      const height = this.height || (typeof window !== "undefined" ? window.innerHeight : 600);
      const spawnX = Math.round(-Math.max(40, this.config.size + 20));
      const spawnY = Math.round(height / 2);
      this.fish = {
        x: spawnX,
        y: spawnY,
        velocityX: 1.5,
        // initial swim-right
        velocityY: 0,
        rotation: 0,
        targetRotation: 0,
        flipScale: 1,
        targetFlipScale: 1,
        age: 0,
        swimPhase: 0,
        isFleeing: false,
        fleeTimer: 0,
        currentSize: this.config.size,
        targetSize: this.config.size,
        targetedFood: null,
        hidden: false,
        skeletonSpawned: false
      };
      this.isAttackingSchoolFish = false;
      this.targetSchoolFish = null;
      this.gameState = "playing";
      delete this._forcedTarget;
    }
    /**
     * Pre-render 4 depth-tinted variants of a source image into OffscreenCanvases.
     * Mirrors FishLayer._buildDepthCache — shared logic kept in sync manually.
     */
    _buildDepthCache(sourceImage) {
      const TIERS = [
        { sat: 30, bri: 100 },
        { sat: 55, bri: 100 },
        { sat: 78, bri: 100 },
        null
        // tier 3: original
      ];
      const w = sourceImage.naturalWidth || sourceImage.width;
      const h = sourceImage.naturalHeight || sourceImage.height;
      if (!w || !h) return TIERS.map(() => sourceImage);
      return TIERS.map((tier) => {
        if (!tier) return sourceImage;
        const oc = new OffscreenCanvas(w, h);
        const octx = oc.getContext("2d");
        octx.filter = `saturate(${tier.sat}%) brightness(${tier.bri}%)`;
        octx.drawImage(sourceImage, 0, 0);
        return oc;
      });
    }
    drawSkeletons(ctx, height) {
      const FALL_DURATION = 3e3;
      const FADE_DURATION = 800;
      const GRAVITY = 2e-4;
      const now = Date.now();
      let writeIdx = 0;
      let anyActive = false;
      for (let i = 0; i < this.skeletons.length; i++) {
        const sk = this.skeletons[i];
        const elapsed = now - sk.startTime;
        if (elapsed > FALL_DURATION + FADE_DURATION) continue;
        const dtSk = now - (sk.lastUpdate || now);
        sk.lastUpdate = now;
        sk.vy += GRAVITY * dtSk;
        sk.vx *= 1 - 3e-3 * (dtSk / 16);
        sk.x += sk.vx * dtSk;
        sk.y += sk.vy * dtSk;
        const alpha = elapsed < FALL_DURATION ? 1 : 1 - (elapsed - FALL_DURATION) / FADE_DURATION;
        if (this.boneLoaded && this.boneImage) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(sk.x, sk.y);
          ctx.scale(sk.flipScale, 1);
          const w = sk.size * 2;
          const h = w * (this.boneImage.height / this.boneImage.width);
          ctx.drawImage(this.boneImage, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
        anyActive = true;
        this.skeletons[writeIdx++] = sk;
      }
      this.skeletons.length = writeIdx;
      if (!anyActive && this.fish && this.fish.isDying) {
        this.skeletons = [];
        this.spawnFish();
      }
    }
    /**
     * Cleanup resources and event listeners
     */
    destroy() {
      document.removeEventListener("mousemove", this.handleMouseMove);
      document.removeEventListener("touchmove", this.handleTouchMove);
      this.fish = null;
      this.hearts = [];
      this.allFish = [];
      this.skeletons = [];
      this.dancePartner = null;
      console.log("CuriousFishLayer destroyed");
    }
  };

  // assets/canvas/core/CanvasManager.js
  var CanvasManager = class {
    constructor(options = {}) {
      this.canvas = null;
      this.ctx = null;
      this.layers = /* @__PURE__ */ new Map();
      this.animationId = null;
      this.isRunning = false;
      this.lastTime = 0;
      this.frameCounter = 0;
      this.mathUtils = new MathUtils();
      this.performanceMonitor = new PerformanceMonitor({
        showStats: options.showStats !== false,
        targetFPS: options.targetFPS || 45
      });
      this.performanceProfiler = new PerformanceProfiler({
        enabled: options.profilePerformance || false,
        logInterval: 2e3
      });
      this.foodLayer = new FoodLayer(this.mathUtils, options.foodConfig);
      this.config = {
        zIndex: options.zIndex || 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        debug: options.debug || false,
        errorHandling: options.errorHandling !== false,
        // Error handling enabled by default
        ...options
      };
      this.width = 0;
      this.height = 0;
      this.resizeTimeout = null;
      this.handleResize = this.handleResize.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleGlobalClick = this.handleGlobalClick.bind(this);
      this.handleTouch = this.handleTouch.bind(this);
      this.performanceMonitor.onQualityChange((quality) => {
        this.applyQualityToLayers(quality);
      });
      this.init();
    }
    /**
     * Initialize canvas and event listeners
     */
    init() {
      this.canvas = document.createElement("canvas");
      this.canvas.id = "canvas-ocean-foreground";
      this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: auto;
            z-index: ${this.config.zIndex};
        `;
      if (this.config.debug) {
        console.log("Canvas element created with z-index:", this.config.zIndex);
        console.log("Canvas pointer-events:", this.canvas.style.pointerEvents);
      }
      this.ctx = this.canvas.getContext("2d", {
        alpha: true,
        desynchronized: true
        // Hint for better performance
      });
      const webglAnchor = document.getElementById("webgl-ocean-background");
      if (webglAnchor && webglAnchor.parentNode) {
        webglAnchor.parentNode.insertBefore(this.canvas, webglAnchor.nextSibling);
        if (this.config.debug) console.log("Canvas element inserted after webgl-ocean-background");
      } else {
        document.body.insertBefore(this.canvas, document.body.firstChild);
        if (this.config.debug) console.log("Canvas element appended to DOM (no webgl anchor found)");
      }
      this.updateCanvasSize();
      window.addEventListener("resize", this.handleResize);
      this.canvas.addEventListener("click", this.handleClick);
      document.addEventListener("click", this.handleGlobalClick);
      document.addEventListener("touchend", this.handleTouch, { passive: true });
      if (this.config.debug) {
        console.log("Canvas element in DOM:", document.getElementById("canvas-ocean-foreground"));
        console.log("Canvas dimensions:", this.canvas.width, "x", this.canvas.height);
      }
    }
    /**
     * Update canvas size for viewport and device pixel ratio
     */
    updateCanvasSize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || this.config.devicePixelRatio || 1, 2);
      const deviceW = Math.max(1, Math.round(rect.width * dpr));
      const deviceH = Math.max(1, Math.round(rect.height * dpr));
      this.canvas.width = deviceW;
      this.canvas.height = deviceH;
      try {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } catch (e) {
        this.ctx.scale(dpr, dpr);
      }
      this.width = rect.width;
      this.height = rect.height;
      if (this.config.debug) {
        console.log("updateCanvasSize", {
          rectWidth: rect.width,
          rectHeight: rect.height,
          deviceW,
          deviceH,
          dpr
        });
      }
    }
    /**
     * Handle window resize with debouncing
     */
    handleResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateCanvasSize();
        this.layers.forEach((layer) => {
          if (layer.onResize) {
            layer.onResize(this.width, this.height);
          }
        });
      }, 100);
    }
    /**
     * Handle canvas click event
     * @param {MouseEvent} e - Click event
     */
    handleClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      e.stopPropagation();
      const quality = this.performanceMonitor.getQuality();
      this.foodLayer.spawn(x, y, quality);
      let curiousFishLayer = this.getLayer("curiousFish");
      if (!curiousFishLayer) {
        curiousFishLayer = new CuriousFishLayer();
        this.addLayer("curiousFish", curiousFishLayer);
      }
      if (!curiousFishLayer.enabled) {
        curiousFishLayer.enabled = true;
        curiousFishLayer.spawnFish();
        curiousFishLayer.gameState = "playing";
        curiousFishLayer.setTargetPoint(x, y, { immediate: true, speed: curiousFishLayer.config.maxSpeed });
      }
      const fishLayer = this.getLayer("fish");
      if (fishLayer && fishLayer.sharks) {
        for (let i = 0, len = fishLayer.sharks.length; i < len; i++) {
          const shark = fishLayer.sharks[i];
          if (shark.isDying) continue;
          const dx = x - shark.x;
          const dy = y - (shark.baseY || shark.y);
          if (dx * dx + dy * dy < shark.size * shark.size) {
            const isSameSpecies = shark.image?.src?.includes("curiousfish");
            if (isSameSpecies) {
              curiousFishLayer.startDance(shark);
            } else {
              const timeSinceLastAttack = performance.now() - curiousFishLayer.lastAttackTime;
              if (timeSinceLastAttack >= curiousFishLayer.attackCooldown) {
                curiousFishLayer.targetSchoolFish = shark;
                curiousFishLayer.isAttackingSchoolFish = true;
                curiousFishLayer.lastAttackTime = performance.now();
              }
            }
            return;
          }
        }
      }
    }
    /**
     * Handle global click event (fallback)
     * @param {MouseEvent} e - Click event
     */
    handleGlobalClick(e) {
      if (!e.target.closest("#pattern-switcher") && e.target !== this.canvas) {
        this.handleClick(e);
      }
    }
    /**
     * Handle touch tap — spawn food at the touch point.
     * Uses changedTouches so it fires on finger-lift (tap end), not drag.
     * @param {TouchEvent} e
     */
    handleTouch(e) {
      if (e.changedTouches.length === 0) return;
      if (e.touches.length > 1) return;
      const touch = e.changedTouches[0];
      this.handleClick({ clientX: touch.clientX, clientY: touch.clientY, stopPropagation: () => {
      } });
    }
    /**
     * Add a rendering layer
     * @param {string} name - Layer identifier
     * @param {Object} layer - Layer instance with render() method
     * @returns {CanvasManager} This instance for chaining
     */
    addLayer(name, layer) {
      this.layers.set(name, layer);
      if (layer.init) {
        layer.init(this.width, this.height, this);
      }
      return this;
    }
    /**
     * Remove a rendering layer
     * @param {string} name - Layer identifier
     * @returns {CanvasManager} This instance for chaining
     */
    removeLayer(name) {
      const layer = this.layers.get(name);
      if (layer && layer.destroy) {
        layer.destroy();
      }
      this.layers.delete(name);
      return this;
    }
    /**
     * Get a specific layer
     * @param {string} name - Layer identifier
     * @returns {Object|undefined} Layer instance
     */
    getLayer(name) {
      return this.layers.get(name);
    }
    /**
     * Apply quality setting to all layers
     * @private
     * @param {number} quality - Quality value (0.3-1.0)
     */
    applyQualityToLayers(quality) {
      this.layers.forEach((layer) => {
        if (layer.setQuality) {
          layer.setQuality(quality);
        }
      });
    }
    /**
     * Render frame (called by MasterRenderer)
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     * @param {number} currentTime - Current timestamp
     * @param {number} deltaTime - Time since last frame
     */
    renderFrame(currentTime, deltaTime) {
      this.performanceProfiler.startFrame();
      this.performanceProfiler.startSection("performanceMonitor");
      this.performanceMonitor.update(currentTime, deltaTime);
      this.performanceProfiler.endSection("performanceMonitor");
      if (!this.ctx || !this.width || !this.height) return;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.foodLayer.resetTargetedFlags();
      this.performanceProfiler.startSection("foodUpdate");
      const quality = this.performanceMonitor.getQuality();
      this.foodLayer.update(this.ctx, deltaTime, this.width, this.height, quality);
      this.performanceProfiler.endSection("foodUpdate");
      if (this.config.errorHandling) {
        this.layers.forEach((layer) => {
          if (layer.enabled !== false) {
            const layerName = layer.constructor?.name || "unknown";
            this.performanceProfiler.startSection(`layer:${layerName}`);
            this.ctx.save();
            try {
              layer.render(this.ctx, currentTime, deltaTime, this.width, this.height);
            } catch (error) {
              console.error("Error rendering layer:", layerName, error);
            }
            this.ctx.restore();
            this.performanceProfiler.endSection(`layer:${layerName}`);
          }
        });
      } else {
        this.layers.forEach((layer) => {
          if (layer.enabled !== false) {
            const layerName = layer.constructor?.name || "unknown";
            this.performanceProfiler.startSection(`layer:${layerName}`);
            this.ctx.save();
            layer.render(this.ctx, currentTime, deltaTime, this.width, this.height);
            this.ctx.restore();
            this.performanceProfiler.endSection(`layer:${layerName}`);
          }
        });
      }
      this.frameCounter++;
      this.performanceProfiler.endFrame(currentTime);
    }
    /**
     * Start rendering loop
     */
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastTime = performance.now();
    }
    /**
     * Stop rendering loop
     */
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
    }
    /**
     * Toggle performance stats display
     */
    togglePerformanceStats() {
      return this.performanceMonitor.toggleStats();
    }
    /**
     * Get food particles for layers that need them
     * @returns {Array} Array of food particles
     */
    getFoodParticles() {
      return this.foodLayer.getParticles();
    }
    /**
     * Clean up resources
     */
    destroy() {
      this.stop();
      window.removeEventListener("resize", this.handleResize);
      this.canvas.removeEventListener("click", this.handleClick);
      document.removeEventListener("click", this.handleGlobalClick);
      document.removeEventListener("touchend", this.handleTouch);
      this.layers.forEach((layer) => {
        if (layer.destroy) layer.destroy();
      });
      this.layers.clear();
      this.foodLayer.clear();
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
    }
  };

  // assets/canvas/utils/DebugPanel.js
  var DebugPanel = class {
    constructor() {
      this.visible = false;
      this.collapsed = false;
      this.element = null;
      this.lastKnownValues = {};
      this.createPanel();
    }
    createPanel() {
      const existing = document.getElementById("debug-panel");
      if (existing) existing.remove();
      this.element = document.createElement("div");
      this.element.id = "debug-panel";
      this.element.innerHTML = `
            <div class="debug-header" id="debug-header">
                <span class="debug-title">\u26A1 PERFORMANCE</span>
                <span class="debug-toggle" id="debug-toggle">\u2212</span>
            </div>
            <div class="debug-content" id="debug-content">
                <div class="debug-section">
                    <div class="debug-row">
                        <span class="debug-label">FPS:</span>
                        <span class="debug-value" id="debug-fps">--</span>
                        <span class="debug-sublabel">/ <span id="debug-fps-max">--</span> max</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Render:</span>
                        <span class="debug-value" id="debug-render-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Total:</span>
                        <span class="debug-value-small" id="debug-total-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Idle:</span>
                        <span class="debug-value-small" id="debug-idle-time">--</span>
                        <span class="debug-sublabel">ms</span>
                    </div>
                </div>
                
                <div class="debug-separator">CANVAS 2D</div>
                <div class="debug-section">
                    <div class="debug-row-compact">
                        <span class="debug-layer">FishLayer</span>
                        <span class="debug-time" id="debug-fish-time">--</span>
                        <span class="debug-count" id="debug-fish-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">CuriousFish</span>
                        <span class="debug-time" id="debug-curious-time">--</span>
                        <span class="debug-count" id="debug-curious-count">(1)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">HudLayer</span>
                        <span class="debug-time" id="debug-hud-time">--</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Food</span>
                        <span class="debug-time" id="debug-food-time">--</span>
                        <span class="debug-count" id="debug-food-count">(--)</span>
                    </div>
                </div>
                
                <div class="debug-separator">WEBGL</div>
                <div class="debug-section">
                    <div class="debug-row-compact">
                        <span class="debug-layer">Light Rays</span>
                        <span class="debug-time" id="debug-rays-time">--</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Bubbles</span>
                        <span class="debug-time" id="debug-bubbles-time">--</span>
                        <span class="debug-count" id="debug-bubbles-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Plankton</span>
                        <span class="debug-time" id="debug-plankton-time">--</span>
                        <span class="debug-count" id="debug-plankton-count">(--)</span>
                    </div>
                    <div class="debug-row-compact">
                        <span class="debug-layer">Gradient</span>
                        <span class="debug-time" id="debug-gradient-time">--</span>
                    </div>
                </div>
                
                <div class="debug-separator">SYSTEM</div>
                <div class="debug-section">
                    <div class="debug-row">
                        <span class="debug-label">Quality:</span>
                        <span class="debug-value" id="debug-quality">100</span>
                        <span class="debug-sublabel">%</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Resolution:</span>
                        <span class="debug-value-small" id="debug-resolution">--</span>
                    </div>
                </div>
            </div>
        `;
      this.addStyles();
      document.body.appendChild(this.element);
      if (!this.visible) this.element.style.display = "none";
      const toggle = document.getElementById("debug-toggle");
      const header = document.getElementById("debug-header");
      if (toggle && header) {
        header.style.cursor = "pointer";
        header.addEventListener("click", () => this.toggle());
      }
    }
    addStyles() {
      const styleId = "debug-panel-styles";
      if (document.getElementById(styleId)) return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
            #debug-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 0;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 11px;
                color: #fff;
                z-index: 10000;
                min-width: 240px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px 8px 0 0;
            }
            
            .debug-title {
                font-weight: 600;
                font-size: 12px;
                letter-spacing: 0.5px;
            }
            
            .debug-toggle {
                font-size: 16px;
                line-height: 1;
                opacity: 0.6;
                transition: opacity 0.2s;
            }
            
            .debug-toggle:hover {
                opacity: 1;
            }
            
            .debug-content {
                padding: 8px 0;
                transition: max-height 0.3s, opacity 0.3s;
                overflow: hidden;
            }
            
            .debug-content.collapsed {
                max-height: 0 !important;
                opacity: 0;
                padding: 0;
            }
            
            .debug-section {
                padding: 6px 12px;
            }
            
            .debug-separator {
                font-size: 9px;
                font-weight: 600;
                color: #888;
                padding: 8px 12px 4px 12px;
                letter-spacing: 1px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                margin-top: 4px;
            }
            
            .debug-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 6px;
                gap: 6px;
            }
            
            .debug-row-compact {
                display: flex;
                align-items: baseline;
                margin-bottom: 4px;
                gap: 6px;
                font-size: 10px;
            }
            
            .debug-label {
                color: #888;
                min-width: 70px;
            }
            
            .debug-layer {
                color: #888;
                flex: 1;
                min-width: 90px;
            }
            
            .debug-value {
                color: #4ade80;
                font-weight: 600;
                font-size: 14px;
            }
            
            .debug-value.warning {
                color: #fbbf24;
            }
            
            .debug-value.error {
                color: #f87171;
            }
            
            .debug-value-small {
                color: #4ade80;
                font-size: 10px;
            }
            
            .debug-sublabel {
                color: #666;
                font-size: 10px;
            }
            
            .debug-time {
                color: #4ade80;
                font-weight: 500;
                min-width: 45px;
                text-align: right;
            }
            
            .debug-time.slow {
                color: #fbbf24;
            }
            
            .debug-time.very-slow {
                color: #f87171;
            }
            
            .debug-count {
                color: #666;
                font-size: 9px;
                min-width: 35px;
            }
        `;
      document.head.appendChild(style);
    }
    toggle() {
      this.collapsed = !this.collapsed;
      const content = document.getElementById("debug-content");
      const toggle = document.getElementById("debug-toggle");
      if (content && toggle) {
        content.classList.toggle("collapsed", this.collapsed);
        toggle.textContent = this.collapsed ? "+" : "\u2212";
      }
    }
    update(stats) {
      if (!this.visible) return;
      const fpsEl = document.getElementById("debug-fps");
      const fpsMaxEl = document.getElementById("debug-fps-max");
      if (fpsEl && stats.fps !== void 0) {
        fpsEl.textContent = stats.fps;
        fpsEl.className = "debug-value";
        if (stats.fps < 40) fpsEl.classList.add("error");
        else if (stats.fps < 55) fpsEl.classList.add("warning");
      }
      if (fpsMaxEl && stats.theoreticalFPS !== void 0) {
        fpsMaxEl.textContent = stats.theoreticalFPS;
      }
      const renderTimeEl = document.getElementById("debug-render-time");
      if (renderTimeEl && stats.renderTime !== void 0) {
        renderTimeEl.textContent = stats.renderTime.toFixed(2);
      }
      const totalTimeEl = document.getElementById("debug-total-time");
      if (totalTimeEl && stats.totalFrameTime !== void 0) {
        totalTimeEl.textContent = stats.totalFrameTime.toFixed(2);
      }
      const idleTimeEl = document.getElementById("debug-idle-time");
      if (idleTimeEl && stats.idleTime !== void 0) {
        idleTimeEl.textContent = stats.idleTime.toFixed(2);
      }
      this.updateLayerTime("fish", stats.layers?.FishLayer);
      this.updateLayerTime("curious", stats.layers?.CuriousFishLayer);
      this.updateLayerTime("hud", stats.layers?.HudLayer);
      this.updateLayerTime("food", stats.food);
      this.updateLayerTime("rays", stats.webgl?.rays);
      this.updateLayerTime("bubbles", stats.webgl?.bubbles);
      this.updateLayerTime("plankton", stats.webgl?.plankton);
      this.updateLayerTime("gradient", stats.webgl?.gradient);
      this.updateCount("fish-count", stats.counts?.fish);
      this.updateCount("food-count", stats.counts?.food);
      this.updateCount("bubbles-count", stats.counts?.bubbles);
      this.updateCount("plankton-count", stats.counts?.plankton);
      const qualityEl = document.getElementById("debug-quality");
      if (qualityEl && stats.quality !== void 0) {
        qualityEl.textContent = Math.round(stats.quality * 100);
      }
      const resEl = document.getElementById("debug-resolution");
      if (resEl && stats.resolution) {
        resEl.textContent = stats.resolution;
      }
    }
    updateLayerTime(id, value) {
      const el = document.getElementById(`debug-${id}-time`);
      if (!el) return;
      let time = 0;
      if (typeof value === "number") {
        time = value;
      } else if (value && value.time !== void 0) {
        time = value.time;
      } else if (value && value.avg !== void 0) {
        time = value.avg;
      }
      if (time > 0) {
        this.lastKnownValues[id] = time;
        el.textContent = `${time.toFixed(2)}ms`;
        el.className = "debug-time";
        if (time > 2) el.classList.add("very-slow");
        else if (time > 1) el.classList.add("slow");
      } else if (this.lastKnownValues[id] !== void 0) {
        const cachedTime = this.lastKnownValues[id];
        el.textContent = `${cachedTime.toFixed(2)}ms`;
        el.className = "debug-time";
        if (cachedTime > 2) el.classList.add("very-slow");
        else if (cachedTime > 1) el.classList.add("slow");
      } else {
        el.textContent = "-";
        el.className = "debug-time";
      }
    }
    updateCount(id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      if (value !== void 0 && value !== null) {
        this.lastKnownValues[`count-${id}`] = value;
        el.textContent = `(${value})`;
      } else if (this.lastKnownValues[`count-${id}`] !== void 0) {
        el.textContent = `(${this.lastKnownValues[`count-${id}`]})`;
      } else {
        el.textContent = "(-)";
      }
    }
    show() {
      this.visible = true;
      if (this.element) this.element.style.display = "block";
    }
    hide() {
      this.visible = false;
      if (this.element) this.element.style.display = "none";
    }
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
      const styles = document.getElementById("debug-panel-styles");
      if (styles) styles.remove();
    }
  };

  // assets/canvas/utils/GlowCache.js
  var REF_SIZE = 80;
  var BLUR_RATIO = 0.6;
  var TOTAL_RADIUS = REF_SIZE * (1 + BLUR_RATIO);
  var FISH_FRAC = REF_SIZE / TOTAL_RADIUS;

  // assets/canvas/layers/FishLayer.js
  var FishLayer = class _FishLayer {
    static MAX_FISH = 150;
    // Hard cap on total fish in the array
    static MAX_PASSIVE_LIFESPAN = 3e5;
    // ms — passive/independent fish live max 5 min
    // Single source of truth for fish layer configuration
    static DEFAULT_CONFIG = {
      schoolCount: null,
      // null = auto-scale by viewport (1 school per 250 000 px²)
      schoolDensity: 25e4,
      // px² per school when schoolCount is null
      size: 1.2,
      // Size multiplier (0.5-2x)
      avoidRadius: 100,
      // Radius to avoid mouse cursor
      verticalMarginTop: 100,
      // Minimum distance from top edge (px)
      verticalMarginBottom: 100,
      // Minimum distance from bottom edge (px)
      showDebug: false
      // Debug visualization
    };
    constructor(options = {}) {
      this.enabled = true;
      this.sharks = [];
      this.bloodParticles = [];
      this._schoolCentroidsCache = /* @__PURE__ */ new Map();
      this.mouseX = null;
      this.mouseY = null;
      this.manager = null;
      this.fishImages = [];
      const imagePaths = [
        "assets/images/fish/shark.webp",
        "assets/images/fish/fish2.webp",
        "assets/images/fish/fish1.webp",
        "assets/images/fish/curiousfish.webp"
      ];
      this.imagesLoaded = 0;
      this.imagesFailed = 0;
      this._imageDepthCache = [];
      imagePaths.forEach((path, index) => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
          this.imagesLoaded++;
          this._imageDepthCache[index] = this._buildDepthCache(img);
          if (this.imagesLoaded === imagePaths.length) {
            console.log("All fish images loaded");
          }
        };
        img.onerror = () => {
          console.error(`Failed to load fish image: ${path}`);
          this.imagesFailed++;
          img._failed = true;
        };
        this.fishImages.push(img);
      });
      this.boneImage = new Image();
      this.boneLoaded = false;
      this.boneImage.onload = () => {
        this.boneLoaded = true;
      };
      this.boneImage.onerror = () => {
        console.warn("Failed to load fishbone image");
      };
      this.boneImage.src = "assets/images/fish/fishbone.webp";
      this.config = {
        ..._FishLayer.DEFAULT_CONFIG,
        ...options
      };
      this._schoolsSpawned = 0;
      this.handleMouseMove = this.handleMouseMove.bind(this);
    }
    handleMouseMove(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }
    init(width, height, canvasManager) {
      this.width = width;
      this.height = height;
      this.sharks = [];
      this._schoolsSpawned = 0;
      this._recalcSchoolCount(width, height);
      this.manager = canvasManager || window.blueOrcaCanvas;
      document.addEventListener("mousemove", this.handleMouseMove);
      console.log("SharkLayer initialized");
    }
    /**
     * Cleanup resources and event listeners
     */
    destroy() {
      document.removeEventListener("mousemove", this.handleMouseMove);
      this.sharks = [];
      this._schoolsSpawned = 0;
      console.log("FishLayer destroyed");
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
      this._recalcSchoolCount(width, height);
    }
    /** Compute auto school count from viewport area unless manually overridden */
    _recalcSchoolCount(width, height) {
      if (this.config.schoolCount !== null) return;
      const area = width * height;
      const density = this.config.schoolDensity || 25e4;
      const count = Math.max(2, Math.min(20, Math.round(area / density)));
      this._autoSchoolCount = count;
    }
    render(ctx, currentTime, deltaTime, width, height) {
      if (!this.enabled) return;
      if (!this._frameCounter) this._frameCounter = 0;
      this._frameCounter++;
      const effectiveSchoolCount = this.config.schoolCount !== null ? this.config.schoolCount : this._autoSchoolCount || this._recalcSchoolCount(width, height) || this._autoSchoolCount;
      while (this._schoolsSpawned < effectiveSchoolCount) {
        this.spawnSchool(width, height);
        this._schoolsSpawned++;
      }
      if (this._schoolsSpawned > effectiveSchoolCount) {
        this.sharks = [];
        this._schoolsSpawned = 0;
      }
      if (this.sharks.length > _FishLayer.MAX_FISH) {
        let culled = 0;
        for (let i = 0; i < this.sharks.length && this.sharks.length - culled > _FishLayer.MAX_FISH; i++) {
          const s = this.sharks[i];
          if (s.passive && s.isIndependent && !s.isDying) {
            s.isDying = true;
            culled++;
          }
        }
      }
      const curiousFishLayer = this.manager && this.manager.getLayer("curiousFish");
      const targetedFish = curiousFishLayer && curiousFishLayer.targetSchoolFish;
      this._schoolCentroidsCache.clear();
      const schoolCentroids = this._schoolCentroidsCache;
      for (const f of this.sharks) {
        if (f.isDying || typeof f.schoolId === "undefined") continue;
        const c = schoolCentroids.get(f.schoolId);
        if (c) {
          let fx = f.x;
          if (Math.abs(fx - c.x / c.count) > width * 0.5) {
            fx += fx < c.x / c.count ? width : -width;
          }
          c.x += fx;
          c.y += f.baseY;
          c.speed += f.speed;
          c.count++;
        } else {
          schoolCentroids.set(f.schoolId, { x: f.x, y: f.baseY, speed: f.speed, count: 1 });
        }
      }
      for (const [, c] of schoolCentroids) {
        c.x = (c.x / c.count % width + width) % width;
        c.y /= c.count;
        c.speed /= c.count;
      }
      if (this.config.showDebug) {
        ctx.strokeStyle = "rgba(255, 100, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, this.config.verticalMarginTop);
        ctx.lineTo(width, this.config.verticalMarginTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, height - this.config.verticalMarginBottom);
        ctx.lineTo(width, height - this.config.verticalMarginBottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < this.sharks.length; readIndex++) {
        const shark = this.sharks[readIndex];
        if (shark.isDying) {
          if (shark.boneY === void 0) {
            const swOff = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
            const vPhase = shark.age / shark.verticalPeriod % 1;
            const vOff = Math.sin(vPhase * Math.PI * 2) * shark.verticalAmplitude;
            shark.boneX = shark.x;
            shark.boneY = shark.baseY + swOff + vOff;
            shark.boneVX = shark.direction * shark.speed / 16;
            shark.boneVY = shark.schoolWaveAmplitude * shark.schoolWaveSpeed * Math.cos(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) + shark.verticalAmplitude * (2 * Math.PI / shark.verticalPeriod) * Math.cos(vPhase * Math.PI * 2);
            const MAX_BONE_V = 0.18;
            const boneSpd = Math.sqrt(shark.boneVX ** 2 + shark.boneVY ** 2);
            if (boneSpd > MAX_BONE_V) {
              const scale = MAX_BONE_V / boneSpd;
              shark.boneVX *= scale;
              shark.boneVY *= scale;
            }
            shark.boneStartTime = currentTime;
            this._spawnBloodCloud(shark.boneX, shark.boneY, shark.size, currentTime);
          }
          const FALL_DURATION = 3e3;
          const FADE_DURATION = 800;
          const elapsed = currentTime - shark.boneStartTime;
          if (elapsed > FALL_DURATION + FADE_DURATION) continue;
          const dt2 = typeof deltaTime === "number" ? deltaTime : 16;
          const GRAVITY = 12e-5;
          shark.boneVY += GRAVITY * dt2;
          shark.boneVX *= 1 - 3e-3 * (dt2 / 16);
          shark.boneX += shark.boneVX * dt2;
          shark.boneY += shark.boneVY * dt2;
          const alpha = elapsed < FALL_DURATION ? 1 : 1 - (elapsed - FALL_DURATION) / FADE_DURATION;
          if (this.boneLoaded && this.boneImage) {
            ctx.save();
            ctx.globalAlpha = alpha;
            try {
              const boneW = shark.size * 1.33;
              const boneH = boneW * (this.boneImage.height / this.boneImage.width) || shark.size;
              ctx.translate(shark.boneX, shark.boneY);
              if (shark.direction < 0) ctx.scale(-1, 1);
              ctx.drawImage(this.boneImage, -boneW / 2, -boneH / 2, boneW, boneH);
            } catch (e) {
            }
            ctx.restore();
          } else {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "rgba(220,220,220,0.95)";
            ctx.beginPath();
            ctx.ellipse(shark.boneX, shark.boneY, shark.size, shark.size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          this.sharks[writeIndex++] = shark;
          continue;
        }
        if (shark.passive && shark.isIndependent && shark.bornAt !== void 0 && currentTime - shark.bornAt > _FishLayer.MAX_PASSIVE_LIFESPAN) {
          shark.isDying = true;
        }
        if (shark.isDancing) {
          shark.age = (shark.age || 0) + deltaTime;
          const schoolWaveOffset2 = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
          const verticalPhase2 = shark.age / shark.verticalPeriod % 1;
          const verticalOffset2 = Math.sin(verticalPhase2 * Math.PI * 2) * shark.verticalAmplitude;
          const currentY2 = shark.baseY + schoolWaveOffset2 + verticalOffset2;
          if (shark !== targetedFish) {
            this.drawShark(ctx, shark.x, currentY2, shark.size, shark.direction, verticalPhase2, shark.image, 0, 0, shark);
          }
          this.sharks[writeIndex++] = shark;
          continue;
        }
        const prevX = shark.x;
        shark.x += shark.direction * shark.speed;
        if (shark.burstVX !== void 0) {
          shark.x += shark.burstVX;
          shark.baseY += shark.burstVY;
          shark.burstVX *= 0.92;
          shark.burstVY *= 0.92;
          if (Math.abs(shark.burstVX) < 0.05 && Math.abs(shark.burstVY) < 0.05) {
            delete shark.burstVX;
            delete shark.burstVY;
          }
        }
        shark.age += deltaTime;
        const schoolWaveOffset = Math.sin(shark.age * shark.schoolWaveSpeed + shark.schoolWavePhase) * shark.schoolWaveAmplitude;
        const verticalPhase = shark.age / shark.verticalPeriod % 1;
        const verticalOffset = Math.sin(verticalPhase * Math.PI * 2) * shark.verticalAmplitude;
        const currentY = shark.baseY + schoolWaveOffset + verticalOffset;
        {
          const safeTop = this.config.verticalMarginTop + shark.size;
          const safeBot = height - this.config.verticalMarginBottom - shark.size;
          if (shark.baseY < safeTop) shark.baseY += (safeTop - shark.baseY) * 0.05;
          else if (shark.baseY > safeBot) shark.baseY += (safeBot - shark.baseY) * 0.05;
        }
        if (this.manager && this.manager.getLayer && !shark.isBeingAttacked) {
          const curiousFishLayer2 = this.manager.getLayer("curiousFish");
          if (curiousFishLayer2 && curiousFishLayer2.enabled && curiousFishLayer2.fish && !curiousFishLayer2.isAttackingSchoolFish) {
            const cfx = curiousFishLayer2.fish.x;
            const cfy = curiousFishLayer2.fish.y;
            const cfSize = curiousFishLayer2.fish.currentSize || curiousFishLayer2.config.size;
            const dx = shark.x - cfx;
            const dy = currentY - cfy;
            const distanceSquared = dx * dx + dy * dy;
            const avoidRadius = this.config.avoidRadius + cfSize;
            const avoidRadiusSquared = avoidRadius * avoidRadius;
            if (distanceSquared < avoidRadiusSquared && distanceSquared > 0) {
              const distance = Math.sqrt(distanceSquared);
              const avoidStrength = (1 - distance / avoidRadius) * 2.5;
              shark.x += dx / distance * avoidStrength;
              shark.baseY += dy / distance * avoidStrength * 0.5;
            }
          }
        }
        const sizeNorm = 40;
        const sizeFactor = Math.max(0.5, shark.size / sizeNorm);
        if (!shark.isIndependent) {
          const baseSeparationRadius = 40 * (1 + (sizeFactor - 1) * 1.5);
          const centroid = schoolCentroids.get(shark.schoolId);
          if (centroid && centroid.count > 1) {
            let cdx = centroid.x - shark.x;
            if (Math.abs(cdx) > width * 0.5) cdx += cdx > 0 ? -width : width;
            const cdy = centroid.y - shark.baseY;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
            const pullT = Math.min(Math.max((cdist - 20) / 180, 0), 1);
            const pullStrength = pullT * pullT * 0.1;
            shark.x += cdx * pullStrength;
            shark.baseY += cdy * pullStrength * 0.15;
            if (shark.baseSpeed !== void 0) {
              shark.speed += (shark.baseSpeed - shark.speed) * 0.02;
            }
          }
          let separationX = 0;
          let separationY = 0;
          let sepChecks = 0;
          for (const other of this.sharks) {
            if (other === shark || other.isDying) continue;
            if (sepChecks++ >= 5) break;
            if (shark.schoolId !== other.schoolId) continue;
            const odx = shark.x - other.x;
            const ody = shark.baseY - other.baseY;
            const odistSq = odx * odx + ody * ody;
            if (odistSq < baseSeparationRadius * baseSeparationRadius && odistSq > 0) {
              const odist = Math.sqrt(odistSq);
              separationX += odx / odist;
              separationY += ody / odist;
            }
          }
          const separationStrength = 0.18 * Math.max(1, sizeFactor * 1.2);
          shark.x += separationX * separationStrength;
          shark.baseY += separationY * 0.04;
        }
        if (this.manager && this.manager.foodLayer && this.manager.foodLayer.getParticles().length > 0) {
          let nearestFood = null;
          let nearestDistSq = 220 * 220;
          for (const food of this.manager.foodLayer.getParticles()) {
            if (food.eaten) continue;
            const fdx = food.x - shark.x;
            const fdy = food.y - currentY;
            const fdistSq = fdx * fdx + fdy * fdy;
            const isAhead = shark.direction > 0 && fdx > -40 || shark.direction < 0 && fdx < 40;
            if (isAhead && fdistSq < nearestDistSq) {
              nearestDistSq = fdistSq;
              nearestFood = food;
            }
          }
          if (nearestFood) {
            const fdx = nearestFood.x - shark.x;
            const fdy = nearestFood.y - currentY;
            const fdist = Math.sqrt(nearestDistSq);
            if (fdist > 0) {
              shark.baseY += fdy / fdist * 0.3;
            }
            if (fdist < 80) {
              shark.speed = Math.min(shark.baseSpeed * 2, shark.speed + 0.03);
            } else {
              shark.speed = Math.max(shark.baseSpeed, shark.speed - 0.02);
            }
            if (nearestDistSq < 14 * 14) {
              nearestFood.eaten = true;
              shark.size = Math.min(80, shark.size + 0.5);
              shark.speed = shark.baseSpeed;
            }
          } else {
            shark.speed = Math.max(shark.baseSpeed, shark.speed - 0.02);
          }
        }
        const dasLayer = this.manager && this.manager.getLayer("das");
        if (dasLayer && dasLayer.fish) {
          const lure = dasLayer._getLurePos(dasLayer.fish);
          const ldx = lure.x - shark.x;
          const ldy = lure.y - currentY;
          const ldistSq = ldx * ldx + ldy * ldy;
          const LURE_RANGE = 220 * 220;
          const isAhead = shark.direction > 0 && ldx > -40 || shark.direction < 0 && ldx < 40;
          if (isAhead && ldistSq < LURE_RANGE) {
            const ldist = Math.sqrt(ldistSq);
            if (ldist > 0) {
              shark.baseY += ldy / ldist * 0.3;
            }
            if (ldist < 80) {
              shark.speed = Math.min(shark.baseSpeed * 2, shark.speed + 0.03);
            }
          }
        }
        const netMove = shark.x - prevX;
        const minMovement = 0.12;
        if (Math.abs(netMove) < minMovement) {
          shark.x += shark.direction * minMovement;
        }
        if (shark.direction > 0 && shark.x > width + shark.size * 2) {
          shark.x = -shark.size * 2;
          const safeZoneTop = this.config.verticalMarginTop;
          const safeZoneBottom = height - this.config.verticalMarginBottom;
          const centroid = schoolCentroids.get(shark.schoolId);
          const targetY = centroid ? centroid.y : shark.baseY;
          shark.baseY = Math.max(safeZoneTop, Math.min(
            safeZoneBottom,
            targetY + (Math.random() - 0.5) * 30
          ));
        } else if (shark.direction < 0 && shark.x < -shark.size * 2) {
          shark.x = width + shark.size * 2;
          const safeZoneTop = this.config.verticalMarginTop;
          const safeZoneBottom = height - this.config.verticalMarginBottom;
          const centroid = schoolCentroids.get(shark.schoolId);
          const targetY = centroid ? centroid.y : shark.baseY;
          shark.baseY = Math.max(safeZoneTop, Math.min(
            safeZoneBottom,
            targetY + (Math.random() - 0.5) * 30
          ));
        }
        if (shark !== targetedFish) {
          this.drawShark(ctx, shark.x, currentY, shark.size, shark.direction, verticalPhase, shark.image, 0, 0, shark);
          if (this.config.showDebug && this.manager && this.manager.getLayer) {
            const curiousFishLayer2 = this.manager.getLayer("curiousFish");
            if (curiousFishLayer2 && curiousFishLayer2.enabled && curiousFishLayer2.fish) {
              ctx.strokeStyle = shark.isBeingAttacked ? "rgba(255, 0, 0, 0.5)" : "rgba(0, 255, 0, 0.3)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(shark.x, currentY, shark.size * 1, shark.size * 0.4, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        this.sharks[writeIndex++] = shark;
      }
      this.sharks.length = writeIndex;
      if (this.bloodParticles.length > 0) {
        const now = currentTime;
        let bpWrite = 0;
        ctx.save();
        for (let i = 0; i < this.bloodParticles.length; i++) {
          const p = this.bloodParticles[i];
          const age = now - p.birth;
          if (age >= p.life) continue;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.97;
          p.vy *= 0.97;
          const t = age / p.life;
          const fadeAlpha = t < 0.05 ? t / 0.05 : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
          ctx.globalAlpha = p.alpha * fadeAlpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          this.bloodParticles[bpWrite++] = p;
        }
        this.bloodParticles.length = bpWrite;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      if (targetedFish && !targetedFish.isDying) {
        const schoolWaveOffset = Math.sin(targetedFish.age * targetedFish.schoolWaveSpeed + targetedFish.schoolWavePhase) * targetedFish.schoolWaveAmplitude;
        const verticalPhase = targetedFish.age / targetedFish.verticalPeriod % 1;
        const verticalOffset = Math.sin(verticalPhase * Math.PI * 2) * targetedFish.verticalAmplitude;
        const currentY = targetedFish.baseY + schoolWaveOffset + verticalOffset;
        this.drawShark(ctx, targetedFish.x, currentY, targetedFish.size, targetedFish.direction, verticalPhase, targetedFish.image, 0, 0, targetedFish);
        if (this.config.showDebug) {
          ctx.strokeStyle = targetedFish.isBeingAttacked ? "rgba(255, 0, 0, 0.7)" : "rgba(255, 255, 0, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(targetedFish.x, currentY, targetedFish.size * 1, targetedFish.size * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    drawShark(ctx, x, y, size, direction, swimPhase, sharkImage, deathRotation = 0, fadeProgress = 0, fishData = null) {
      if (this.imagesLoaded + this.imagesFailed < this.fishImages.length) {
        ctx.save();
        ctx.translate(x, y);
        if (direction < 0) ctx.scale(-1, 1);
        ctx.fillStyle = "rgba(100, 150, 200, 0.5)";
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (!sharkImage || sharkImage._failed) return;
      ctx.save();
      ctx.translate(x, y);
      if (fishData && fishData.flipX !== void 0) {
        ctx.scale(fishData.flipX, 1);
      } else if (direction < 0) {
        ctx.scale(-1, 1);
      }
      ctx.globalAlpha = 1;
      const imgIndex = fishData && fishData._imageIndex !== void 0 ? fishData._imageIndex : this.fishImages.indexOf(sharkImage);
      const tier = fishData && fishData.depthTier !== void 0 ? fishData.depthTier : this.height > 0 ? Math.max(0, Math.min(3, Math.floor(y / this.height * 4))) : 3;
      const drawSrc = imgIndex >= 0 && this._imageDepthCache[imgIndex] ? this._imageDepthCache[imgIndex][tier] : sharkImage;
      if (deathRotation > 0) {
        ctx.rotate(deathRotation);
      } else {
        const t = fishData ? fishData.age : swimPhase * 2e3;
        const tilt = Math.sin(t / 2500 * Math.PI * 2) * 7e-3 + Math.sin(t / 4100 * Math.PI * 2 + 1.3) * 4e-3;
        ctx.rotate(tilt);
      }
      if (fadeProgress > 0) {
        const grayscale = Math.round(fadeProgress * 100);
        const brightness = Math.round(100 - fadeProgress * 70);
        ctx.filter = `grayscale(${grayscale}%) brightness(${brightness}%)`;
      }
      const hitAge = fishData?._hitFlashTime ? Date.now() - fishData._hitFlashTime : Infinity;
      const isHitFlash = hitAge < 220;
      const imgWidth = size * 2;
      const imgHeight = size * (sharkImage.height / sharkImage.width) * 2;
      ctx.drawImage(drawSrc, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      if (isHitFlash) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = 0.55 * (1 - hitAge / 220);
        ctx.fillStyle = "#ff1500";
        ctx.fillRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    spawnSchool(width, height) {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const archetype = this._schoolsSpawned % 4;
      const fishType = archetype === 0 ? 0 : archetype === 1 ? 1 : archetype === 2 ? 2 : 3;
      let baseSize, schoolImage, fishCountBase;
      if (fishType === 0) {
        schoolImage = this.fishImages[0];
        baseSize = 50 + Math.random() * 70;
        fishCountBase = [1, 1];
      } else if (fishType === 1) {
        schoolImage = this.fishImages[1];
        baseSize = 10 + Math.random() * 20;
        fishCountBase = [12, 20];
      } else if (fishType === 2) {
        schoolImage = this.fishImages[2];
        baseSize = 4 + Math.random() * 4;
        fishCountBase = [25, 45];
      } else {
        schoolImage = this.fishImages[3];
        baseSize = 30 + Math.random() * 30;
        fishCountBase = [2, 4];
      }
      const sizeVariation = 0.5 + Math.random();
      const schoolSize = Math.max(fishType === 2 ? 5 : fishType === 0 ? 50 : 30, baseSize * sizeVariation * this.config.size);
      const depthTier = schoolSize > 70 ? 3 : schoolSize > 50 ? 2 : schoolSize > 35 ? 1 : 0;
      const speedT = Math.min(1, Math.max(0, (schoolSize - 30) / 90));
      const schoolSpeed = 0.35 + speedT * 1.15 + (Math.random() - 0.5) * 0.3;
      const countVariation = 0.7 + Math.random() * 0.6;
      const fishCount = Math.max(1, Math.floor(
        (fishCountBase[0] + Math.random() * (fishCountBase[1] - fishCountBase[0])) * countVariation
      ));
      const safeZoneTop = this.config.verticalMarginTop;
      const safeZoneBottom = height - this.config.verticalMarginBottom;
      const safeZoneHeight = safeZoneBottom - safeZoneTop;
      const tierFraction = (3 - depthTier) / 3;
      const tierCentreY = safeZoneTop + safeZoneHeight * (0.1 + tierFraction * 0.8);
      let schoolY = tierCentreY + (Math.random() - 0.5) * safeZoneHeight * 0.2;
      if (fishType === 2) {
        const dasLayer = this.manager && this.manager.getLayer("das");
        if (dasLayer && dasLayer.fish) {
          const dasY = dasLayer.fish.y;
          const avoidBand = 90;
          if (Math.abs(schoolY - dasY) < avoidBand) {
            const shift = dasY - schoolY > 0 ? -avoidBand * 1.5 : avoidBand * 1.5;
            schoolY = Math.max(safeZoneTop + 20, Math.min(safeZoneBottom - 20, schoolY + shift));
          }
        }
      }
      const schoolCenterX = direction > 0 ? -schoolSize * 2 : width + schoolSize * 2;
      const schoolWavePhase = Math.random() * Math.PI * 2;
      const schoolWaveSpeed = 8e-4 + Math.random() * 6e-4;
      const schoolWaveAmplitude = 8 + Math.random() * 10;
      for (let i = 0; i < fishCount; i++) {
        const individualSize = Math.max(fishType === 2 ? 5 : fishType === 0 ? 50 : 30, schoolSize * (0.4 + Math.random() * 0.3));
        const spreadFactorX = 2.5 + individualSize / schoolSize;
        const spreadFactorY = 1.5 + individualSize / schoolSize * 0.5;
        const offsetX = (Math.random() - 0.5) * individualSize * spreadFactorX;
        const offsetY = (Math.random() - 0.5) * individualSize * spreadFactorY;
        const fishSpeed = schoolSpeed * (0.9 + Math.random() * 0.2);
        this.sharks.push({
          x: schoolCenterX + offsetX,
          baseY: schoolY + offsetY,
          size: individualSize,
          speed: fishSpeed,
          baseSpeed: fishSpeed,
          schoolId: this._schoolsSpawned,
          fishType,
          depthTier,
          direction,
          verticalAmplitude: 2 + Math.random() * 4,
          verticalPeriod: 5e3 + Math.random() * 5e3,
          age: Math.random() * 1e3,
          image: schoolImage,
          _imageIndex: fishType,
          // O(1) lookup in drawShark — invariant: fishType 0/1/2/3 maps directly to fishImages[fishType]
          schoolWavePhase,
          schoolWaveSpeed,
          schoolWaveAmplitude,
          tailPeriod: 280 + Math.random() * 220
        });
      }
    }
    /**
     * Spawn a large school from the right side heading left — used for the intro cinematic.
     * @param {number} width
     * @param {number} height
     * @param {number} targetY  - vertical centre for the school (default: canvas mid)
     */
    spawnIntroSchool(width, height, targetY) {
      const direction = 1;
      const schoolImage = this.fishImages[1];
      const fishCount = 35 + Math.floor(Math.random() * 20);
      const baseSize = 16;
      const schoolSpeed = 1.4;
      const centreY = targetY ?? height * 0.6;
      const schoolId = -1;
      const schoolWavePhase = Math.random() * Math.PI * 2;
      const schoolWaveSpeed = 9e-4;
      const schoolWaveAmplitude = 12;
      for (let i = 0; i < fishCount; i++) {
        const sz = baseSize * (0.7 + Math.random() * 0.6);
        const ox = (Math.random() - 0.5) * sz * 7;
        const oy = (Math.random() - 0.5) * sz * 3;
        this.sharks.push({
          x: -sz * 3 + ox,
          baseY: centreY + oy,
          size: sz,
          speed: schoolSpeed * (0.9 + Math.random() * 0.2),
          baseSpeed: schoolSpeed,
          schoolId,
          fishType: 1,
          depthTier: 1,
          direction,
          verticalAmplitude: 3 + Math.random() * 3,
          verticalPeriod: 4e3 + Math.random() * 3e3,
          age: Math.random() * 500,
          image: schoolImage,
          _imageIndex: 1,
          // fishImages[1] = fish2.webp
          schoolWavePhase,
          schoolWaveSpeed,
          schoolWaveAmplitude,
          tailPeriod: 260 + Math.random() * 180
        });
      }
    }
    /**
     * Spawn a blood cloud of soft round particles that gently expand and fade.
     * @param {number} x
     * @param {number} y
     * @param {number} size           - fish size, scales count and radius
     * @param {number|null} impactAngle - directional bias (null = full circle)
     */
    _spawnBloodBurst(x, y, size, impactAngle = null, spawnTime = 0) {
      const PALETTE = ["#8b0000", "#a80000", "#c01010", "#6a0000", "#b02000", "#cc0000"];
      const now = spawnTime;
      const count = Math.max(30, Math.min(70, Math.floor(size * 0.65)));
      for (let i = 0; i < count; i++) {
        const angle = impactAngle !== null ? impactAngle + (Math.random() - 0.5) * Math.PI * 1.6 : Math.random() * Math.PI * 2;
        const speed = 0.15 + Math.random() * 0.55;
        const r = size * (0.04 + Math.random() * 0.1);
        const life = 3500 + Math.random() * 1500;
        this.bloodParticles.push({
          x: x + (Math.random() - 0.5) * size * 0.3,
          y: y + (Math.random() - 0.5) * size * 0.2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.6,
          radius: r,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          alpha: 0.45 + Math.random() * 0.4,
          birth: now,
          life
        });
      }
    }
    /** Alias used by the dying-fish path (purely radial, no impact angle). */
    _spawnBloodCloud(x, y, size, spawnTime = 0) {
      this._spawnBloodBurst(x, y, size, null, spawnTime);
    }
    /**
     * Pre-render 4 depth-tinted variants of a source image into OffscreenCanvases.
     * Tier 0 = deepest (desaturated+dark), Tier 3 = surface (original).
     * Cost: called once per image on load, ~1 ms.
     */
    _buildDepthCache(sourceImage) {
      const TIERS = [
        { sat: 30, bri: 100 },
        { sat: 55, bri: 100 },
        { sat: 78, bri: 100 },
        null
        // tier 3: original, no processing
      ];
      const w = sourceImage.naturalWidth || sourceImage.width;
      const h = sourceImage.naturalHeight || sourceImage.height;
      if (!w || !h) return TIERS.map(() => sourceImage);
      return TIERS.map((tier) => {
        if (!tier) return sourceImage;
        const oc = new OffscreenCanvas(w, h);
        const octx = oc.getContext("2d");
        octx.filter = `saturate(${tier.sat}%) brightness(${tier.bri}%)`;
        octx.drawImage(sourceImage, 0, 0);
        return oc;
      });
    }
    /**
     * Predation pass: sharks (fishType 0) with size > 50 eat nearby smaller fish.
     * Runs once per render frame before the main draw loop.
     */
    _doPredation(currentTime) {
      const EAT_COOLDOWN = 1800;
      const EAT_DIST_FACTOR = 1.4;
      const PREY_SIZE_FACTOR = 0.65;
      const MIN_PREDATOR_SIZE = 50;
      for (const predator of this.sharks) {
        if (predator.isDying) continue;
        if (predator.fishType !== 0) continue;
        if (predator.size < MIN_PREDATOR_SIZE) continue;
        if (predator.lastEatTime && currentTime - predator.lastEatTime < EAT_COOLDOWN) continue;
        const eatRadiusSq = (predator.size * EAT_DIST_FACTOR) ** 2;
        for (const prey of this.sharks) {
          if (prey === predator) continue;
          if (prey.isDying) continue;
          if (prey.size >= predator.size * PREY_SIZE_FACTOR) continue;
          if (prey.depthTier !== predator.depthTier) continue;
          const dx = prey.x - predator.x;
          const dy = prey.baseY - predator.baseY;
          if (dx * dx + dy * dy < eatRadiusSq) {
            prey.isDying = true;
            predator.lastEatTime = currentTime;
            break;
          }
        }
      }
    }
  };

  // assets/canvas/layers/DasFishLayer.js
  var DasFishLayer = class _DasFishLayer {
    static DEFAULT_CONFIG = {
      size: 100,
      // half-width used for edge margin
      speed: 0.5,
      // px per frame at 60 fps
      turnRate: 5e-3,
      // max radians turned per frame — very slow
      lureRadius: 30
      // kill radius around the lure orb
    };
    constructor(options = {}) {
      this.enabled = true;
      this.manager = null;
      this.config = { ..._DasFishLayer.DEFAULT_CONFIG, ...options };
      this.fish = null;
      this._image = new Image();
      this._imageLoaded = false;
      this._depthCache = null;
      this._glitch = {
        cooldown: 1e3 + Math.random() * 2e3,
        effect: null,
        // 'freeze'|'tear'|'ghost'
        timer: 0,
        speedMul: 1,
        data: {}
      };
      this._intro = true;
      this._image.onload = () => {
        this._imageLoaded = true;
        this._depthCache = this._buildDepthCache(this._image);
      };
      this._image.onerror = () => {
        console.warn("[DasFishLayer] Failed to load das.png");
      };
      this._image.src = "assets/images/fish/das.webp";
    }
    init(width, height, canvasManager) {
      this.width = width;
      this.height = height;
      this.manager = canvasManager;
    }
    onResize(width, height) {
      this.width = width;
      this.height = height;
    }
    destroy() {
      this.fish = null;
    }
    // ─── Spawn ───────────────────────────────────────────────────────────────
    _spawn() {
      const goRight = this._intro ? false : Math.random() < 0.5;
      const midY = this.height * 0.6;
      this.fish = {
        x: goRight ? -this.config.size : this.width + this.config.size,
        y: this._intro ? midY : this.height * (0.5 + Math.random() * 0.3),
        vx: (goRight ? 1 : -1) * this.config.speed,
        size: this.config.size,
        age: 0
      };
      if (this._intro) {
        const fishLayer = this.manager && this.manager.getLayer("fish");
        if (fishLayer && typeof fishLayer.spawnIntroSchool === "function") {
          fishLayer.spawnIntroSchool(this.width, this.height, midY);
        }
      }
    }
    // ─── Update ──────────────────────────────────────────────────────────────
    _update(deltaTime) {
      const f = this.fish;
      const dt = typeof deltaTime === "number" ? deltaTime : 16;
      const spd = this.config.speed * (dt / 16);
      f.age += dt;
      this._updateGlitch(dt);
      if (this._intro && f.age > 5e3) {
        this._intro = false;
      }
      const effectiveSpd = spd * this._glitch.speedMul;
      f.x += f.vx > 0 ? effectiveSpd : -effectiveSpd;
      f.y += Math.sin(f.age * 4e-4) * 0.18 * (dt / 16);
      const margin = f.size;
      f.y = Math.max(margin, Math.min(this.height - margin, f.y));
      if (f.vx > 0 && f.x > this.width + f.size * 2) {
        f.x = -f.size;
        f.y = this.height * (0.5 + Math.random() * 0.3);
      } else if (f.vx < 0 && f.x < -f.size * 2) {
        f.x = this.width + f.size;
        f.y = this.height * (0.5 + Math.random() * 0.3);
      }
    }
    // ─── Lure world position ─────────────────────────────────────────────────
    // The lure hangs in front of the fish and slightly above.
    // Forward offset along travel direction + fixed world-up offset.
    _getLurePos(f) {
      const dir = f.vx >= 0 ? 1 : -1;
      return {
        x: f.x + dir * (f.size * 0.76 - 10),
        y: f.y - f.size * 0.02,
        r: this.config.lureRadius
      };
    }
    // ─── Kill checks ─────────────────────────────────────────────────────────
    _checkKills() {
      const lure = this._getLurePos(this.fish);
      const now = performance.now();
      const SURVIVE_COOLDOWN = 500;
      const fishLayer = this.manager && this.manager.getLayer("fish");
      if (fishLayer && fishLayer.sharks) {
        for (const shark of fishLayer.sharks) {
          if (shark.isDying) continue;
          const dx = lure.x - shark.x;
          const dy = lure.y - (shark.baseY || shark.y || 0);
          const threshold = lure.r + shark.size * 0.5;
          if (dx * dx + dy * dy < threshold * threshold) {
            if (shark._dasCooldownUntil && now < shark._dasCooldownUntil) continue;
            if (Math.random() < 0.7) {
              shark._dasCooldownUntil = now + SURVIVE_COOLDOWN;
            } else {
              shark.isDying = true;
            }
          }
        }
      }
      const curiousLayer = this.manager && this.manager.getLayer("curiousFish");
      if (curiousLayer && curiousLayer.fish && !curiousLayer.fish.isDying) {
        const cf = curiousLayer.fish;
        const cfSize = cf.currentSize || curiousLayer.config?.size || 20;
        const dx = lure.x - cf.x;
        const dy = lure.y - cf.y;
        const threshold = lure.r + cfSize * 0.5;
        if (dx * dx + dy * dy < threshold * threshold) {
          if (cf._dasCooldownUntil && now < cf._dasCooldownUntil) {
          } else if (Math.random() < 0.7) {
            cf._dasCooldownUntil = now + SURVIVE_COOLDOWN;
          } else {
            cf.isDying = true;
          }
        }
      }
    }
    // ─── Glitch ──────────────────────────────────────────────────────────────
    _updateGlitch(dt) {
      const g = this._glitch;
      if (g.effect) {
        g.timer -= dt;
        if (g.effect === "freeze") g.data.elapsed = (g.data.elapsed || 0) + dt;
        if (g.timer <= 0) {
          g.effect = null;
          g.speedMul = 1;
          g.data = {};
          g.cooldown = 1e3 + Math.random() * 2e3;
        }
      } else {
        g.cooldown -= dt;
        if (g.cooldown <= 0) this._triggerGlitch();
      }
    }
    _triggerGlitch() {
      const g = this._glitch;
      const effects = ["freeze", "freeze", "freeze", "tear", "tear", "tearV", "tearV", "ghost", "ghost2"];
      g.effect = effects[Math.floor(Math.random() * effects.length)];
      g.data = {};
      switch (g.effect) {
        case "freeze":
          g.timer = 700 + Math.random() * 500;
          g.speedMul = 0.05;
          g.data.total = g.timer;
          break;
        case "tear":
          g.timer = 100 + Math.random() * 250;
          g.speedMul = 1;
          break;
        case "tearV":
          g.timer = 100 + Math.random() * 250;
          g.speedMul = 1;
          break;
        case "ghost":
          g.timer = 150 + Math.random() * 280;
          g.speedMul = 0.4;
          break;
        case "ghost2":
          g.timer = 150 + Math.random() * 280;
          g.speedMul = 0.4;
          break;
      }
    }
    // ─── Render ──────────────────────────────────────────────────────────────
    render(ctx, currentTime, deltaTime, width, height) {
      if (!this.enabled) return;
      this.width = width;
      this.height = height;
      if (!this.fish && width > 0 && height > 0) this._spawn();
      if (!this.fish) return;
      this._update(deltaTime);
      this._checkKills();
      const f = this.fish;
      if (!this._imageLoaded) {
        ctx.save();
        ctx.fillStyle = "rgba(200,80,0,0.6)";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      const g = this._glitch;
      const depthTier = height > 0 ? Math.min(3, Math.max(0, Math.floor(f.y / height * 4))) : 3;
      const drawSrc = this._depthCache && this._depthCache[depthTier] || this._image;
      const imgW = f.size * 2;
      const imgH = imgW * (this._image.height / this._image.width);
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1);
      switch (g.effect) {
        case "freeze": {
          const FADE = 400;
          const elapsed = g.data.elapsed || 0;
          const total = g.data.total || 700;
          let sat;
          if (elapsed < FADE) {
            sat = 100 - elapsed / FADE * 100;
          } else if (elapsed > total - FADE) {
            sat = (elapsed - (total - FADE)) / FADE * 100;
          } else {
            sat = 0;
          }
          ctx.filter = `saturate(${sat.toFixed(1)}%)`;
          ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
          ctx.filter = "none";
          break;
        }
        case "ghost":
          ctx.globalAlpha = 0.35;
          ctx.filter = "hue-rotate(120deg) saturate(300%)";
          ctx.drawImage(drawSrc, -imgW / 2 + 9, -imgH / 2 - 5, imgW, imgH);
          ctx.filter = "none";
          ctx.globalAlpha = 1;
          ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
          break;
        case "ghost2":
          ctx.globalAlpha = 0.35;
          ctx.filter = "hue-rotate(255deg) saturate(300%)";
          ctx.drawImage(drawSrc, -imgW / 2 - 7, -imgH / 2 + 8, imgW, imgH);
          ctx.filter = "none";
          ctx.globalAlpha = 1;
          ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
          break;
        case "tear": {
          const sliceH = imgH / 3;
          for (let i = 0; i < 3; i++) {
            const ox = (i % 2 === 0 ? 1 : -1) * (3 + Math.floor(Math.random() * 10));
            ctx.save();
            ctx.beginPath();
            ctx.rect(-imgW / 2 + ox - 1, -imgH / 2 + i * sliceH, imgW + 2, sliceH);
            ctx.clip();
            ctx.drawImage(drawSrc, -imgW / 2 + ox, -imgH / 2, imgW, imgH);
            ctx.restore();
          }
          break;
        }
        case "tearV": {
          const sliceW = imgW / 5;
          for (let i = 0; i < 5; i++) {
            const oy = (i % 2 === 0 ? 1 : -1) * (3 + Math.floor(Math.random() * 10));
            ctx.save();
            ctx.beginPath();
            ctx.rect(-imgW / 2 + i * sliceW, -imgH / 2 + oy - 1, sliceW, imgH + 2);
            ctx.clip();
            ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2 + oy, imgW, imgH);
            ctx.restore();
          }
          break;
        }
        default:
          ctx.drawImage(drawSrc, -imgW / 2, -imgH / 2, imgW, imgH);
      }
      if (g.effect === "freeze") {
        ctx.save();
        ctx.translate(0, imgH * 0.05);
        const angle = currentTime % 1200 / 1200 * Math.PI * 2;
        for (let d = 0; d < 8; d++) {
          const a = angle + d / 8 * Math.PI * 2;
          ctx.globalAlpha = 0.2 + d / 8 * 0.75;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 9, Math.sin(a) * 9, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
      if (this.showDebug) {
        const lure = this._getLurePos(f);
        ctx.save();
        ctx.strokeStyle = "rgba(255,0,0,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lure.x, lure.y, lure.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,0,0,0.25)";
        ctx.fill();
        ctx.restore();
      }
    }
    // ─── Depth cache (same pattern as FishLayer) ─────────────────────────────
    _buildDepthCache(sourceImage) {
      const TIERS = [
        { sat: 30, bri: 100 },
        { sat: 55, bri: 100 },
        { sat: 78, bri: 100 },
        null
        // tier 3: original
      ];
      const w = sourceImage.naturalWidth || sourceImage.width;
      const h = sourceImage.naturalHeight || sourceImage.height;
      if (!w || !h) return TIERS.map(() => sourceImage);
      return TIERS.map((tier) => {
        if (!tier) return sourceImage;
        const oc = new OffscreenCanvas(w, h);
        const octx = oc.getContext("2d");
        octx.filter = `saturate(${tier.sat}%) brightness(${tier.bri}%)`;
        octx.drawImage(sourceImage, 0, 0);
        return oc;
      });
    }
  };

  // assets/canvas/index.js
  function createCanvasBackground(options = {}) {
    const manager = new CanvasManager(options);
    return manager;
  }
  console.log("Canvas Background System 2.0 loaded");

  // assets/core/MasterRenderer.js
  var MasterRenderer = class {
    /**
     * @param {Object} [options]
     * @param {number} [options.canvas2dFPS=45] - Target FPS for the 2D canvas throttle.
     *   Lower values on weak devices reduce CPU load while keeping WebGL smooth.
     */
    constructor(options = {}) {
      this.webglRenderer = null;
      this.canvasManager = null;
      this.rafId = null;
      this.lastTime = 0;
      this.isRunning = false;
      this.fpsUpdateTime = 0;
      this.frameCount = 0;
      this.currentFPS = 60;
      this.fpsLogTime = 0;
      this.canvas2dInterval = 1e3 / (options.canvas2dFPS || 45);
      this.lastCanvas2dTime = 0;
      this.tier = 0;
      this.lowFpsSince = null;
      this.LOW_FPS_THRESHOLD = 28;
      this.LOW_FPS_DURATION = 5e3;
      this.debugPanel = null;
      this._pausedByVisibility = false;
      this._visibilityListenerAdded = false;
      this._onVisibilityChange = null;
      this.render = this.render.bind(this);
    }
    /**
     * Register WebGL renderer and disable its internal rAF loop
     * @param {WebGLOceanRenderer} renderer 
     */
    registerWebGLRenderer(renderer) {
      this.webglRenderer = renderer;
      if (renderer.rafId) {
        cancelAnimationFrame(renderer.rafId);
        renderer.rafId = null;
      }
    }
    /**
     * Register Canvas Manager and disable its internal rAF loop
     * @param {CanvasManager} manager 
     */
    registerCanvasManager(manager) {
      this.canvasManager = manager;
      if (manager.animationId) {
        cancelAnimationFrame(manager.animationId);
        manager.animationId = null;
      }
    }
    /**
     * Start unified render loop
     */
    start() {
      if (this.isRunning) return;
      if (!this.webglRenderer && this.tier === 0) this.tier = 1;
      this.isRunning = true;
      this.lastTime = performance.now();
      this.fpsUpdateTime = this.lastTime;
      this.frameCount = 0;
      this.debugPanel = new DebugPanel();
      this.rafId = requestAnimationFrame(this.render);
      if (!this._visibilityListenerAdded) {
        this._onVisibilityChange = () => {
          if (document.hidden) {
            if (this.isRunning) {
              this._pausedByVisibility = true;
              this.stop();
            }
          } else if (this._pausedByVisibility) {
            this._pausedByVisibility = false;
            this.lastTime = performance.now();
            this.lastCanvas2dTime = this.lastTime;
            this.start();
          }
        };
        document.addEventListener("visibilitychange", this._onVisibilityChange);
        this._visibilityListenerAdded = true;
      }
    }
    /**
     * Stop unified render loop
     */
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    /**
     * Main unified render loop
     * Renders both WebGL and 2D Canvas in correct order with shared timing
     * @param {number} currentTime - Timestamp from requestAnimationFrame
     */
    render(currentTime) {
      if (!this.isRunning) return;
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;
      const renderStart = performance.now();
      if (this.webglRenderer && this.webglRenderer.gl) {
        this.webglRenderer.renderFrame(currentTime, deltaTime);
      }
      if (this.canvasManager && this.canvasManager.ctx) {
        if (currentTime - this.lastCanvas2dTime >= this.canvas2dInterval) {
          const canvas2dDelta = currentTime - this.lastCanvas2dTime;
          this.lastCanvas2dTime = currentTime;
          this.canvasManager.renderFrame(currentTime, canvas2dDelta);
        }
      }
      const renderEnd = performance.now();
      this.lastRenderTime = renderEnd - renderStart;
      this.updateFPSDisplay(currentTime, deltaTime);
      this.rafId = requestAnimationFrame(this.render);
    }
    /**
     * Update FPS display (replaces setInterval approach)
     * @param {number} currentTime 
     */
    updateFPSDisplay(currentTime, deltaTime) {
      this.frameCount++;
      if (currentTime - this.fpsUpdateTime >= 500) {
        this.currentFPS = Math.round(this.frameCount * 1e3 / (currentTime - this.fpsUpdateTime));
        this.frameCount = 0;
        this.fpsUpdateTime = currentTime;
        if (this.tier < 2) {
          if (this.currentFPS < this.LOW_FPS_THRESHOLD) {
            if (this.lowFpsSince === null) this.lowFpsSince = currentTime;
            if (currentTime - this.lowFpsSince >= this.LOW_FPS_DURATION) {
              this.lowFpsSince = null;
              if (this.tier === 0) this.disableWebGL();
              else this.disableCanvas();
            }
          } else {
            this.lowFpsSince = null;
          }
        }
        if (currentTime - this.fpsLogTime >= 5e3) {
          console.log(`FPS: ${this.currentFPS}`);
          this.fpsLogTime = currentTime;
        }
        const theoreticalFPS = this.lastRenderTime > 0 ? Math.round(1e3 / this.lastRenderTime) : 0;
        const realMaxFPS = deltaTime > 0 ? Math.round(1e3 / deltaTime) : 0;
        const idleTime = deltaTime - this.lastRenderTime;
        const stats = {
          fps: this.currentFPS,
          theoreticalFPS: realMaxFPS,
          // Real max based on total frame time
          renderTime: this.lastRenderTime,
          totalFrameTime: deltaTime,
          idleTime,
          layers: {},
          webgl: {},
          counts: {},
          quality: 1,
          resolution: ""
        };
        if (this.canvasManager) {
          const profiler = this.canvasManager.performanceProfiler;
          if (profiler && profiler.sections) {
            stats.layers = {
              FishLayer: profiler.sections["layer:FishLayer"],
              CuriousFishLayer: profiler.sections["layer:CuriousFishLayer"],
              HudLayer: profiler.sections["layer:HudLayer"]
            };
            if (profiler.sections.foodUpdate) {
              stats.food = {
                time: profiler.sections.foodUpdate.avg
              };
            }
          }
          const fishLayer = this.canvasManager.getLayer("fish");
          if (fishLayer && fishLayer.sharks) {
            stats.counts.fish = fishLayer.sharks.length;
          }
          const foodLayer = this.canvasManager.foodLayer;
          if (foodLayer && foodLayer.getParticles) {
            stats.counts.food = foodLayer.getParticles().length;
          }
          const perfMon = this.canvasManager.performanceMonitor;
          if (perfMon) {
            stats.quality = perfMon.qualityMultiplier || 1;
          }
          stats.resolution = `${this.canvasManager.canvas.width}\xD7${this.canvasManager.canvas.height}`;
        }
        if (this.webglRenderer) {
          if (this.webglRenderer.lastProfileTimes) {
            const times = this.webglRenderer.lastProfileTimes;
            stats.webgl = {
              gradient: times.gradient ? { time: times.gradient } : null,
              rays: times.rays ? { time: times.rays } : null,
              bubbles: times.bubbles ? { time: times.bubbles } : null,
              plankton: times.plankton ? { time: times.plankton } : null
            };
          }
          if (this.webglRenderer.bubblesLayer && this.webglRenderer.bubblesLayer.particleCount) {
            stats.counts.bubbles = this.webglRenderer.bubblesLayer.particleCount;
          }
          if (this.webglRenderer.planktonLayer && this.webglRenderer.planktonLayer.particleCount) {
            stats.counts.plankton = this.webglRenderer.planktonLayer.particleCount;
          }
        }
        if (this.debugPanel) {
          this.debugPanel.update(stats);
        }
      }
    }
    /**
     * Tier 1: hide WebGL canvas, let CSS body gradient show through.
     * Triggered automatically when FPS < LOW_FPS_THRESHOLD for LOW_FPS_DURATION ms.
     */
    disableWebGL() {
      if (this.webglRenderer) {
        this.webglRenderer.canvas.style.display = "none";
        this.webglRenderer = null;
      }
      this.tier = 1;
      console.warn("[MasterRenderer] Tier 1: WebGL disabled \u2014 CSS background active");
    }
    /**
     * Tier 2: destroy 2D canvas entirely. CSS background only.
     */
    disableCanvas() {
      if (this.canvasManager) {
        this.canvasManager.destroy();
        this.canvasManager = null;
      }
      this.tier = 2;
      console.warn("[MasterRenderer] Tier 2: Canvas disabled \u2014 CSS background only");
    }
    /**
     * Get current FPS
     * @returns {number}
     */
    getFPS() {
      return this.currentFPS;
    }
  };

  // assets/canvas/init.js
  function initCanvasBackground() {
    const { entityBudget: budget } = getDeviceProfile();
    const manager = createCanvasBackground({
      zIndex: 0,
      showStats: true,
      targetFPS: 60,
      debug: false,
      errorHandling: false,
      // Disable error handling for max performance
      profilePerformance: false,
      // Disabled: triggers CpuProfiler overhead every session
      skipDefaultLayers: true,
      // Layer configurations - optional overrides of DEFAULT_CONFIG
      foodConfig: {
        // count: 6,        // Number of food particles (FoodLayer.DEFAULT_CONFIG)
        // size: 5,         // Size of food particles
        // fallSpeed: 0.25, // Fall speed
        // spread: 30,      // Horizontal spread
        // shrinkRate: 0.05 // Shrink rate in px/second
      },
      fishConfig: {
        schoolDensity: budget.schoolDensity
        // schoolCount: 6,      // Number of schools — set null to use density-based auto-scaling
        // size: 1.2,           // Size multiplier (0.5-2x)
        // avoidRadius: 100,    // Radius to avoid mouse cursor
        // showDebug: false     // Debug visualization
      },
      curiousFishConfig: {
        // speed: 5.0,          // Fish movement speed (CuriousFishLayer.DEFAULT_CONFIG)
        // maxSpeed: 2.0,       // Maximum speed
        // size: 30,            // Initial fish size
        // maxFishSize: 150,    // Maximum fish size
        // followDistance: 60   // Distance to follow cursor
      }
    });
    const fishLayer = new FishLayer(manager.config.fishConfig || {});
    manager.addLayer("fish", fishLayer);
    const dasFishLayer = new DasFishLayer();
    manager.addLayer("das", dasFishLayer);
    const masterRenderer = new MasterRenderer({ canvas2dFPS: budget.canvas2dFPS });
    if (window.webglOceanRenderer) {
      masterRenderer.registerWebGLRenderer(window.webglOceanRenderer);
    }
    manager.start();
    masterRenderer.registerCanvasManager(manager);
    manager.performanceMonitor.onQualityChange((q) => {
      window.webglOceanRenderer?.setQuality(q);
    });
    masterRenderer.start();
    window.blueOrcaCanvas = manager;
    window.blueOrcaMasterRenderer = masterRenderer;
    return manager;
  }
  if (typeof window !== "undefined" && !window.blueOrcaCanvas) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initCanvasBackground();
      });
    } else {
      initCanvasBackground();
    }
  }
})();

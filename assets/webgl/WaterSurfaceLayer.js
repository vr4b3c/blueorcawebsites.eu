/**
 * WaterSurfaceLayer
 *
 * Animovaná vodní hladina na y = SURFACE_Y (70px od vrchu) —
 * stejná hranice jako PlanktonLayer topGap.
 *
 * Dva render průchody:
 *   1. Surface fill (TRIANGLE_STRIP) — od y=0 dolů k vlně:
 *      - jemný modrý tint nad hladinou (vzduch nad vodou)
 *      - jasné bílé highlight přímo na vlně
 *   2. Foam particles (POINTS) — částice plující na hladině
 */

export const SURFACE_Y = 70; // px od vrchu — stejné jako PlanktonLayer topEdge

export class WaterSurfaceLayer {
    constructor(gl, config = {}) {
        this.gl = gl;
        this.program = null;       // surface fill shader
        this.foamProgram = null;   // foam particle shader
        this.vao = null;
        this.foamVao = null;
        this.buffers = {};
        this.enabled = true;
        this.qualityMultiplier = 1.0;
        this._budgetFactor = 1.0;
        this._targetBudgetFactor = 1.0;
        this._foam = [];
        this._foamBuf = null;      // Float32Array pro upload na GPU

        this.config = {
            columns: 256,   // rozlišení vlny
            foamCount: 120, // počet foam částic
            ...config
        };
    }

    init(width, height) {
        this.width = width;
        this.height = height;

        this.compileWaveShaders();
        this.compileFoamShaders();
        this.createWaveBuffers();
        this.initFoamParticles();
        this.createFoamBuffers();

        const gl = this.gl;
        if (this.program) {
            gl.useProgram(this.program);
            gl.uniform2f(this.locs.resolution, width, height);
        }
        if (this.foamProgram) {
            gl.useProgram(this.foamProgram);
            gl.uniform2f(this.foamLocs.resolution, width, height);
        }
    }

    // ─── Surface fill shaders ────────────────────────────────────────────────
    // Geometrie: TRIANGLE_STRIP, každý sloupec má dva vrcholy:
    //   a_t = -1.0 → horní hrana pásku
    //   a_t = +1.0 → dolní hrana pásku
    // Fragment: alpha bell-curve — maximum uprostřed, 0 na krajích

    compileWaveShaders() {
        const vertSrc = `#version 300 es
            in float a_x;    // normalized column 0..1
            in float a_t;    // -1 = top edge, +1 = bottom edge of ribbon

            uniform vec2 u_resolution;
            uniform float u_time;

            out float v_t;

            void main() {
                float xPx = a_x * u_resolution.x;

                // 5 inkomenzurabilních harmonik — klidná ale přirozeně nepravidelná vlna
                float wave = 3.0  * sin(xPx * 0.012 + u_time * 0.00045)
                           + 1.5  * sin(xPx * 0.027 + u_time * 0.00073)
                           + 0.9  * sin(xPx * 0.051 + u_time * 0.00110)
                           + 0.5  * sin(xPx * 0.089 + u_time * 0.00161)
                           + 0.3  * sin(xPx * 0.143 + u_time * 0.00094);

                // ±4px geometrie — nikdy sub-pixel, pow() to vizuálně ořeže na ~1px
                float yPx = ${SURFACE_Y}.0 + wave + a_t * 4.0;

                vec2 clip = (vec2(xPx, yPx) / u_resolution) * 2.0 - 1.0;
                clip.y = -clip.y;
                gl_Position = vec4(clip, 0.0, 1.0);
                v_t = a_t;
            }
        `;

        const fragSrc = `#version 300 es
            precision mediump float;
            in float v_t;
            out vec4 outColor;

            void main() {
                // pow(bell, 6) → ostrý hrot uprostřed, padá rychle k nule
                // vizuálně ~1-2px i když geometrie má 8px
                float bell = 1.0 - abs(v_t);
                float alpha = pow(bell, 6.0) * 0.38;
                if (alpha < 0.005) discard;
                outColor = vec4(0.88, 0.97, 1.0, alpha);
            }
        `;

        this.program = this.createProgram(vertSrc, fragSrc);
        if (this.program) {
            const gl = this.gl;
            const p  = this.program;
            this.locs = {
                resolution: gl.getUniformLocation(p, 'u_resolution'),
                time:       gl.getUniformLocation(p, 'u_time'),
                x:          gl.getAttribLocation(p, 'a_x'),
                t:          gl.getAttribLocation(p, 'a_t'),
            };
        }
    }

    createWaveBuffers() {
        const gl = this.gl;
        const N = this.config.columns;

        // TRIANGLE_STRIP interleaved: top_col0, bot_col0, top_col1, bot_col1, ...
        const xs = new Float32Array(N * 2);
        const ts = new Float32Array(N * 2); // 0=top(y=0), 1=bottom(y=waveY+6)

        for (let i = 0; i < N; i++) {
            const nx = i / (N - 1);
            xs[i * 2]     = nx;
            xs[i * 2 + 1] = nx;
            ts[i * 2]     = -1.0; // top edge
            ts[i * 2 + 1] =  1.0; // bottom edge
        }

        const upload = (data) => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            return buf;
        };

        this.buffers.x           = upload(xs);
        this.buffers.t           = upload(ts);
        this.buffers.vertexCount = N * 2;

        if (this.locs) {
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);

            gl.enableVertexAttribArray(this.locs.x);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.x);
            gl.vertexAttribPointer(this.locs.x, 1, gl.FLOAT, false, 0, 0);

            gl.enableVertexAttribArray(this.locs.t);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.t);
            gl.vertexAttribPointer(this.locs.t, 1, gl.FLOAT, false, 0, 0);

            gl.bindVertexArray(null);
        }
    }

    // ─── Foam particle shaders ───────────────────────────────────────────────

    compileFoamShaders() {
        const vertSrc = `#version 300 es
            in vec2 a_pos;       // pixel position [xPx, yPx]
            in float a_size;     // point size in px
            in float a_opacity;  // pre-computed opacity

            uniform vec2 u_resolution;

            out float v_opacity;

            void main() {
                vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
                clip.y = -clip.y;
                gl_Position = vec4(clip, 0.0, 1.0);
                gl_PointSize = a_size;
                v_opacity = a_opacity;
            }
        `;

        const fragSrc = `#version 300 es
            precision mediump float;
            in float v_opacity;
            out vec4 outColor;

            void main() {
                vec2 c = gl_PointCoord - vec2(0.5);
                if (length(c) > 0.5) discard;
                float alpha = smoothstep(0.5, 0.15, length(c)) * v_opacity;
                outColor = vec4(0.90, 0.97, 1.0, alpha);
            }
        `;

        this.foamProgram = this.createProgram(vertSrc, fragSrc);
        if (this.foamProgram) {
            const gl = this.gl;
            const p  = this.foamProgram;
            this.foamLocs = {
                resolution: gl.getUniformLocation(p, 'u_resolution'),
                pos:        gl.getAttribLocation(p, 'a_pos'),
                size:       gl.getAttribLocation(p, 'a_size'),
                opacity:    gl.getAttribLocation(p, 'a_opacity'),
            };
        }
    }

    // ─── Foam particle simulation (JS-side) ──────────────────────────────────

    initFoamParticles() {
        const count = this.config.foamCount;
        this._foam = [];
        for (let i = 0; i < count; i++) {
            const p = this._newFoamParticle();
            p.age = Math.random() * p.maxAge; // rozložit počáteční fáze
            p.yOffset = p.riseSpeed * (p.age / 1000); // pre-compute rise
            this._foam.push(p);
        }
        this._foamBuf = new Float32Array(count * 4); // [xPx, yPx, size, opacity]
    }

    _newFoamParticle() {
        return {
            x:         Math.random(),                       // normalized 0..1
            size:      2 + Math.random() * 4,               // px (2–6px) — jemné
            age:       0,
            maxAge:    1200 + Math.random() * 1600,         // ms
            driftX:    (Math.random() - 0.5) * 0.00001,    // velmi jemný horizontální drift
            riseSpeed: 6 + Math.random() * 12,              // px/s — stoupání nahoru
            yOffset:   0,                                   // px nad hladinou
        };
    }

    /** Wave y-position in pixels at given normalized x and time — must match vertex shader. */
    _waveYpx(normX, t) {
        const xPx = normX * this.width;
        return SURFACE_Y
            + 3.0 * Math.sin(xPx * 0.012 + t * 0.00045)
            + 1.5 * Math.sin(xPx * 0.027 + t * 0.00073)
            + 0.9 * Math.sin(xPx * 0.051 + t * 0.00110)
            + 0.5 * Math.sin(xPx * 0.089 + t * 0.00161)
            + 0.3 * Math.sin(xPx * 0.143 + t * 0.00094);
    }

    createFoamBuffers() {
        const gl    = this.gl;
        const count = this._foam.length;

        // Interleaved DYNAMIC buffer: [xPx, yPx, size, opacity] × count
        this.buffers.foam = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.foam);
        gl.bufferData(gl.ARRAY_BUFFER, this._foamBuf, gl.DYNAMIC_DRAW);

        if (this.foamLocs) {
            this.foamVao = gl.createVertexArray();
            gl.bindVertexArray(this.foamVao);

            const stride = 4 * 4; // 4 floats × 4 bytes
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.foam);

            gl.enableVertexAttribArray(this.foamLocs.pos);
            gl.vertexAttribPointer(this.foamLocs.pos, 2, gl.FLOAT, false, stride, 0);

            gl.enableVertexAttribArray(this.foamLocs.size);
            gl.vertexAttribPointer(this.foamLocs.size, 1, gl.FLOAT, false, stride, 8);

            gl.enableVertexAttribArray(this.foamLocs.opacity);
            gl.vertexAttribPointer(this.foamLocs.opacity, 1, gl.FLOAT, false, stride, 12);

            gl.bindVertexArray(null);
        }
    }

    /** Update foam positions in JS, fill _foamBuf, return effective particle count. */
    updateFoam(elapsed, deltaTime) {
        const effectiveCount = Math.floor(
            this._foam.length * Math.min(this.qualityMultiplier, this._budgetFactor)
        );

        for (let i = 0; i < effectiveCount; i++) {
            const p = this._foam[i];
            p.age += deltaTime;

            if (p.age >= p.maxAge) {
                const fresh = this._newFoamParticle();
                this._foam[i] = fresh;
                // Use fresh reference from here
                this._writeFoamVertex(i, fresh, elapsed, 0);
                continue;
            }

            p.x = (p.x + p.driftX * deltaTime + 1.0) % 1.0;
            p.yOffset += p.riseSpeed * deltaTime / 1000;

            this._writeFoamVertex(i, p, elapsed, p.age);
        }

        return effectiveCount;
    }

    _writeFoamVertex(i, p, elapsed, age) {
        const waveY = this._waveYpx(p.x, elapsed);

        // Stoupání nahoru od hladiny, fade-in rychle, fade-out lineárně
        const t = age / p.maxAge;
        let opacity;
        if (t < 0.12) opacity = t / 0.12;
        else          opacity = 1.0 - ((t - 0.12) / 0.88);
        opacity *= 0.55 * this.qualityMultiplier;

        const j = i * 4;
        this._foamBuf[j]     = p.x * this.width;
        // Vždy min. 8px nad vrcholem ribbon (ribbon má ±4px + rezerva pro mismatch)
        this._foamBuf[j + 1] = waveY - Math.max(p.yOffset, 8);
        this._foamBuf[j + 2] = p.size;
        this._foamBuf[j + 3] = opacity;
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    render(elapsed, deltaTime) {
        const gl = this.gl;

        this._budgetFactor += (this._targetBudgetFactor - this._budgetFactor) * 0.06;

        // 1. Wave ribbon
        if (this.program && this.vao) {
            gl.useProgram(this.program);
            gl.uniform1f(this.locs.time, elapsed);
            gl.bindVertexArray(this.vao);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.vertexCount);
        }

        // 2. Foam particles — update JS state, upload, draw
        if (this.foamProgram && this.foamVao) {
            const count = this.updateFoam(elapsed, deltaTime);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.foam);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._foamBuf, 0, count * 4);
            gl.useProgram(this.foamProgram);
            gl.bindVertexArray(this.foamVao);
            gl.drawArrays(gl.POINTS, 0, count);
        }
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    setQuality(quality) {
        this.qualityMultiplier = quality;
    }

    reduceBudget(factor) {
        this._targetBudgetFactor = Math.max(0.1, factor);
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        if (this.program) {
            this.gl.useProgram(this.program);
            this.gl.uniform2f(this.locs.resolution, width, height);
        }
        if (this.foamProgram) {
            this.gl.useProgram(this.foamProgram);
            this.gl.uniform2f(this.foamLocs.resolution, width, height);
        }
    }

    toggle(enabled) {
        this.enabled = !!enabled;
        if (this.enabled && !this.program && this.width && this.height) {
            this.init(this.width, this.height);
        }
    }

    destroy() {
        const gl = this.gl;
        if (this.program)     gl.deleteProgram(this.program);
        if (this.foamProgram) gl.deleteProgram(this.foamProgram);
        if (this.vao)         gl.deleteVertexArray(this.vao);
        if (this.foamVao)     gl.deleteVertexArray(this.foamVao);
        if (this.buffers.x)    gl.deleteBuffer(this.buffers.x);
        if (this.buffers.t)    gl.deleteBuffer(this.buffers.t);
        if (this.buffers.foam) gl.deleteBuffer(this.buffers.foam);
    }

    // ─── Shader compilation ──────────────────────────────────────────────────

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertShader, vertexSource);
        gl.compileShader(vertShader);
        if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
            console.error('WaterSurface vertex shader:', gl.getShaderInfoLog(vertShader));
            return null;
        }

        const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragShader, fragmentSource);
        gl.compileShader(fragShader);
        if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
            console.error('WaterSurface fragment shader:', gl.getShaderInfoLog(fragShader));
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('WaterSurface program link:', gl.getProgramInfoLog(program));
            return null;
        }

        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        return program;
    }
}

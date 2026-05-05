# Canvas Layer Lifecycle Documentation

Kompletní dokumentace životního cyklu a událostí pro všechny Canvas vrstvy v Blue Orca projektu.

## 📋 Obsah

1. [Životní cyklus vrstvy](#životní-cyklus-vrstvy)
2. [Události a Callbacks](#události-a-callbacks)
3. [Dokumentace jednotlivých vrstev](#dokumentace-jednotlivých-vrstev)
4. [Best Practices](#best-practices)

---

## Životní cyklus vrstvy

### Fáze životního cyklu

```
┌──────────────┐
│ VYTVOŘENÍ    │  constructor()
└──────┬───────┘
       │
       v
┌──────────────┐
│ INICIALIZACE │  init(width, height, manager)
└──────┬───────┘
       │
       v
┌──────────────┐
│ RENDERING    │  render() - každý frame
└──────┬───────┘
       │
       ├─► onResize() - při změně velikosti
       ├─► setQuality() - při změně výkonu
       │
       v
┌──────────────┐
│ UKONČENÍ     │  destroy()
└──────────────┘
```

### 1. VYTVOŘENÍ (Constructor)

**Kdy**: Při vytvoření instance třídy

**Účel**: Inicializace základních vlastností a konfigurace

**Co dělat**:
- ✅ Nastavit výchozí konfiguraci
- ✅ Inicializovat prázdná pole/mapy
- ✅ Nastavit `this.enabled = true`
- ✅ Načíst obrázky/zdroje
- ✅ Bindovat event handlery

**Co nedělat**:
- ❌ Nepřistupovat k DOM
- ❌ Nespouštět animace
- ❌ Nevytvářet velké datové struktury
- ❌ Neočekávat známé rozměry canvasu

**Příklad**:
```javascript
constructor(options = {}) {
    this.enabled = true;
    this.particles = [];
    this.config = {
        count: 50,
        speed: 1.0,
        ...options
    };
    this.image = new Image();
    this.image.src = 'path/to/image.png';
}
```

### 2. INICIALIZACE (init)

**Kdy**: Po přidání vrstvy do CanvasManager

**Parametry**: 
- `width` - Šířka canvasu
- `height` - Výška canvasu  
- `manager` - Reference na CanvasManager

**Účel**: Připravit vrstvu pro rendering

**Co dělat**:
- ✅ Uložit rozměry canvasu
- ✅ Uložit referenci na manager
- ✅ Vytvořit/inicializovat objekty podle rozměrů
- ✅ Vypočítat pozice elementů
- ✅ Přidat event listenery přes manager
- ✅ Připravit cache/pools

**Co nedělat**:
- ❌ Nemodifikovat DOM přímo
- ❌ Neblokovat main thread
- ❌ Nepředpokládat že obrázky jsou načtené

**Příklad**:
```javascript
init(width, height, manager) {
    this.width = width;
    this.height = height;
    this.manager = manager;
    
    // Spawn initial particles
    for (let i = 0; i < this.config.count; i++) {
        this.spawnParticle();
    }
    
    // Add event listener through manager
    if (manager && manager.canvas) {
        manager.canvas.addEventListener('mousemove', this.handleMouseMove);
    }
}
```

### 3. RENDERING (render)

**Kdy**: Každý frame (~60x za sekundu)

**Parametry**:
- `ctx` - Canvas 2D context
- `currentTime` - Aktuální čas v ms (performance.now())
- `deltaTime` - Čas od posledního framu v ms
- `width` - Aktuální šířka canvasu
- `height` - Aktuální výška canvasu

**Účel**: Vykreslit frame vrstvy

**Co dělat**:
- ✅ Zkontrolovat `if (!this.enabled) return;`
- ✅ Aktualizovat stav objektů (pozice, animace)
- ✅ Použít `deltaTime` pro smooth animace
- ✅ Vykreslit na context
- ✅ Používat ctx.save() / ctx.restore()

**Co nedělat**:
- ❌ Nevytvářet nové objekty každý frame
- ❌ Nemodifikovat DOM
- ❌ Nevolat těžké operace (JSON.parse, regex)
- ❌ Nelogovat do console každý frame

**Příklad**:
```javascript
render(ctx, currentTime, deltaTime, width, height) {
    if (!this.enabled) return;
    
    ctx.save();
    
    // Update and draw particles
    for (let particle of this.particles) {
        // Update position (deltaTime for smooth animation)
        particle.x += particle.vx * deltaTime * 0.001;
        particle.y += particle.vy * deltaTime * 0.001;
        
        // Draw
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    
    ctx.restore();
}
```

### 4. ZMĚNA VELIKOSTI (onResize)

**Kdy**: Při změně velikosti okna/canvasu

**Parametry**:
- `width` - Nová šířka
- `height` - Nová výška

**Účel**: Přizpůsobit vrstvu novým rozměrům

**Co dělat**:
- ✅ Aktualizovat uložené rozměry
- ✅ Přepočítat pozice objektů
- ✅ Vyčistit cache závislé na rozměrech
- ✅ Repositionovat elementy

**Příklad**:
```javascript
onResize(width, height) {
    this.width = width;
    this.height = height;
    
    // Clear dimension-dependent cache
    this.gradientCache.clear();
    
    // Reposition particles within new bounds
    for (let particle of this.particles) {
        particle.x = Math.min(particle.x, width);
        particle.y = Math.min(particle.y, height);
    }
}
```

### 5. ZMĚNA KVALITY (setQuality)

**Kdy**: Při poklesu/vzestupu FPS

**Parametry**:
- `quality` - Kvalita (0.1 - 1.0)

**Účel**: Přizpůsobit detail/počet objektů výkonu

**Co dělat**:
- ✅ Upravit počet objektů podle kvality
- ✅ Změnit detail renderingu
- ✅ Vypnout efekty při nízké kvalitě

**Příklad**:
```javascript
setQuality(quality) {
    this.qualityMultiplier = quality;
    
    // Adjust particle count
    const targetCount = Math.floor(this.config.count * quality);
    while (this.particles.length > targetCount) {
        this.particles.pop();
    }
}
```

### 6. UKONČENÍ (destroy)

**Kdy**: Před odstraněním vrstvy z manageru

**Účel**: Vyčistit zdroje

**Co dělat**:
- ✅ Odstranit event listenery
- ✅ Vyčistit timery/intervals
- ✅ Uvolnit velké objekty
- ✅ Nullovat reference

**Příklad**:
```javascript
destroy() {
    // Remove event listeners
    if (this.manager && this.manager.canvas) {
        this.manager.canvas.removeEventListener('mousemove', this.handleMouseMove);
    }
    
    // Clear data
    this.particles = [];
    this.gradientCache.clear();
    
    // Null references
    this.manager = null;
}
```

---

## Události a Callbacks

### Manager Events

```javascript
// Canvas click - spawn food
manager.canvas.addEventListener('click', (e) => {
    const rect = manager.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    manager.foodSystem.spawn(x, y, 'high');
});

// Mouse move - track cursor
manager.canvas.addEventListener('mousemove', (e) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
});
```

### Komunikace mezi vrstvami

```javascript
// Přístup k food particles z jiné vrstvy
const foodParticles = this.manager.getFoodParticles();

// Přístup k jiné vrstvě
const sharkLayer = this.manager.getLayer('shark');
if (sharkLayer && sharkLayer.sharks) {
    // Interact with sharks
}
```

---

## Dokumentace jednotlivých vrstev

### 1. WaterGradientLayer

**Účel**: Animovaný vodní gradient pozadí

**Životní cyklus**:
1. **Constructor**: Nastavení gradient konfigurací
2. **init**: Cache gradient metadata
3. **render**: Vykreslit gradienty s pulsing efektem
4. **onResize**: Vyčistit cache a přepočítat

**Události**: Žádné

**Performance optimalizace**:
- ✅ Pre-cached gradient metadata
- ✅ Reuse gradient objects
- ✅ Simple sin calculation for pulsing

**Příklad použití**:
```javascript
const gradient = new WaterGradientLayer({
    animationDuration: 10000,
    gradients: [/* custom config */]
});
manager.addLayer('gradient', gradient);
```

---

### 2. LightRaysLayer

**Účel**: Světelné paprsky pronikající vodou

**Životní cyklus**:
1. **Constructor**: Nastavení počtu paprsků
2. **init**: Spawn initial rays
3. **render**: Animovat a vykreslit paprsky
4. **onResize**: Repositionovat paprsky
5. **setQuality**: Upravit počet paprsků

**Události**: Žádné

**Animace**:
- Slow sway motion (sin/cos)
- Opacity fade along ray length
- Continuous horizontal drift

---

### 3. BubblesLayer

**Účel**: Stoupající bubliny s kymácením

**Životní cyklus**:
1. **Constructor**: Konfigurace bublin, object pool
2. **init**: Inicializace rozměrů
3. **render**: Spawn, update, draw bubbles
4. **onResize**: Vyčistit gradient cache
5. **setQuality**: Upravit počet bublin

**Performance optimalizace**:
- ✅ Object pooling (getFromPool/returnToPool)
- ✅ Gradient caching
- ✅ Quality-based particle count

**Animace**:
- Rising motion (constant speed)
- Sway motion (sin wave)
- Size scaling (shrink as rise)
- Opacity fade at top

---

### 4. PlanktonLayer

**Účel**: Plovoucí částice planktonu

**Životní cyklus**:
1. **Constructor**: Konfigurace swarms
2. **init**: Spawn plankton particles
3. **render**: Drift animation
4. **onResize**: Reposition particles
5. **setQuality**: Adjust particle count

**Animace**:
- Slow vertical float
- Horizontal drift
- Subtle opacity pulse

---

### 5. SharkLayer

**Účel**: Hejna rybiček plavajících po canvasu

**Životní cyklus**:
1. **Constructor**: Načíst fish obrázky, bind events
2. **init**: Spawn initial schools, add mouse listener
3. **render**: Update school positions, draw fish, handle eating
4. **onResize**: Adjust school positions
5. **destroy**: Remove mouse listener

**Události**:
- `mousemove` - Avoid cursor
- Click detection - Fish eat food particles

**Interakce**:
- School cohesion (flocking)
- Mouse avoidance
- Food particle consumption
- Growth over time

**Typy ryb**:
- Golden parent fish (po rozmnožení)
- Regular school fish
- Multiple image variants

---

### 6. CuriousFishLayer

**Účel**: Interaktivní hlavní ryba

**Životní cyklus**:
1. **Constructor**: Načíst rybu, konfigurace
2. **init**: Spawn fish, add mouse listener, cache DOM
3. **render**: Follow cursor, animations, lifecycle, task tracking
4. **onResize**: Reposition fish
5. **destroy**: Remove listeners

**Události**:
- `mousemove` - Follow cursor
- Click detection - Attack/eat
- Idle detection - Reverse behavior

**Životní fáze**:
1. **Young** - Růst, konzumace jídla
2. **Aggressive** - Může útočit na jiné ryby
3. **Romantic** - Může se rozmnožit (pink glow)

**Task tracking**:
- Feed (vykrmit se)
- Kill 3 competitors (zabít ryby)
- Reproduce (rozmnožit se)
- Survive (nezemřít)

**Game Over podmínky**:
- Attack larger fish → death
- Kill last specimen → extinction

**Interakce**:
- Follows mouse cursor
- Eats food particles → grows
- Attacks school fish → kills them
- Mates with romantic partner → golden parent
- Spawns baby fish → new generation

---

## Best Practices

### ✅ DO

1. **Používejte deltaTime**
   ```javascript
   particle.x += particle.vx * deltaTime * 0.001; // Smooth at any FPS
   ```

2. **Object pooling pro časté alokace**
   ```javascript
   const bubble = this.bubblePool.pop() || { x: 0, y: 0 };
   ```

3. **Cache expensive calculations**
   ```javascript
   if (!this.cachedGradient) {
       this.cachedGradient = ctx.createRadialGradient(/*...*/);
   }
   ```

4. **Zkontrolujte enabled flag**
   ```javascript
   render(ctx, currentTime, deltaTime) {
       if (!this.enabled) return;
       // ...
   }
   ```

5. **ctx.save() / ctx.restore()**
   ```javascript
   ctx.save();
   ctx.globalAlpha = 0.5;
   // draw stuff
   ctx.restore();
   ```

### ❌ DON'T

1. **Nevytvářejte objekty každý frame**
   ```javascript
   // ❌ BAD
   render() {
       const config = { x: 0, y: 0 }; // New object every frame!
   }
   
   // ✅ GOOD
   constructor() {
       this.config = { x: 0, y: 0 }; // Reuse
   }
   ```

2. **Nelogujte každý frame**
   ```javascript
   // ❌ BAD
   render() {
       console.log('rendering...'); // 60x per second!
   }
   ```

3. **Neblokujte main thread**
   ```javascript
   // ❌ BAD
   init() {
       for (let i = 0; i < 1000000; i++) { /* ... */ }
   }
   ```

4. **Nezapomeňte vyčistit listenery**
   ```javascript
   // ❌ BAD - memory leak
   init() {
       document.addEventListener('click', this.handler);
   }
   
   // ✅ GOOD
   destroy() {
       document.removeEventListener('click', this.handler);
   }
   ```

---

## Debugging

### Performance profiling

```javascript
const start = performance.now();
layer.render(ctx, currentTime, deltaTime, width, height);
const duration = performance.now() - start;
if (duration > 16) { // >16ms = <60fps
    console.warn(`Slow render: ${duration.toFixed(2)}ms`);
}
```

### Visual debugging

```javascript
render(ctx, currentTime, deltaTime, width, height) {
    if (this.config.showDebug) {
        ctx.strokeStyle = 'red';
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}
```

### State inspection

```javascript
// In console
const manager = window.blueOrcaCanvas;
const layer = manager.getLayer('shark');
console.log(layer.sharks); // Inspect state
```

---

**Poslední aktualizace**: 23. ledna 2026  
**Verze**: 2.0.0

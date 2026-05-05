# 🐟 Lifecycle Configuration

Kompletní dokumentace konfigurace životního cyklu curious fish.

## 📁 Struktura 

```
canvas/config/
└── LifecycleConfig.js    # Centrální konfigurace všech fází
```

## 🎯 Účel

Všechny parametry chování, vzhledu a schopností rybky v různých životních fázích jsou **pevně oddělené** v jednom konfiguračním souboru. To umožňuje:

- ✅ **Rychlé úpravy** - změna jedné hodnoty ovlivní celé chování
- ✅ **Přehlednost** - všechna pravidla na jednom místě
- ✅ **Testovatelnost** - snadno měnit hodnoty pro experimenty
- ✅ **Dokumentace** - jasné komentáře u každého parametru

## 🔄 Životní fáze

### 1. **YOUNG** (Mládě) 🐟
```javascript
// Aktivace: výchozí stav
// Ukončení: při dosažení 50% velikosti
```

**Parametry:**
- Modrá záře (`rgba(100, 200, 255, 0.8)`)
- Může jíst ✅
- Nemůže útočit ❌
- Nemůže se párovat ❌
- Idle symbol: 🍎 jablko
- Rychlost: 100%

### 2. **AGGRESSIVE** (Dravec) 🦈
```javascript
// Aktivace: velikost >= 50%
// Ukončení: po 4 zabití
```

**Parametry:**
- Červená záře (`rgba(255, 50, 50, 0.8)`)
- Může jíst ✅
- Může útočit ✅
- Nemůže se párovat ❌
- Idle symbol: ⚡ blesk
- Rychlost: 110%
- Zaměřovací kurzor: ✅

### 3. **ROMANTIC** (Romantik) 💕
```javascript
// Aktivace: 4+ zabití
// Ukončení: nikdy (finální fáze)
```

**Parametry:**
- Růžová záře (`rgba(255, 105, 180, 0.8)`)
- Může jíst ✅
- Může útočit ✅
- Může se párovat ✅
- Idle symbol: ❤️ srdce
- Rychlost: 120%
- Zaměřovací kurzor: ✅
- Párovací tanec: 3s

## 🔧 Jak upravit chování

### Změna podmínky přechodu fáze

```javascript
// LifecycleConfig.js
export const LIFECYCLE_TRANSITIONS = {
    young_to_aggressive: {
        threshold: 0.7,  // ← změna z 0.5 na 0.7 (70% velikosti)
    }
};
```

### Změna schopnosti fáze

```javascript
// LifecycleConfig.js
export const LIFECYCLE_PHASES = {
    young: {
        canAttack: true,  // ← umožnit útok už v young fázi
    }
};
```

### Změna vzhledu

```javascript
aggressive: {
    glowColor: 'rgba(0, 255, 0, 0.8)',  // ← zelená místo červené
    glowIntensity: 1.0,                 // ← silnější záře
}
```

## 🎮 API

### Hlavní funkce

```javascript
// Získat konfiguraci fáze
const config = getPhaseConfig('aggressive');

// Zkontrolovat schopnost akce
const canEat = canPerformAction('young', 'eat', currentSize, maxSize);

// Získat idle symbol
const symbol = getIdleSymbol('romantic');  // → 'heart'

// Získat glow vlastnosti
const glow = getGlowProperties('young');  // → { color: '...', intensity: 0.6 }
```

### Použití v CuriousFishLayer

```javascript
// Import
import { 
    LIFECYCLE_PHASES, 
    getPhaseConfig,
    canPerformAction 
} from '../config/LifecycleConfig.js';

// Získání aktuální konfigurace
const config = this.getCurrentPhaseConfig();

// Kontrola schopnosti
if (this.canPerformAction('attack')) {
    // Útok povolen
}
```

## 📊 Všechny parametry

| Parametr | Young | Aggressive | Romantic |
|----------|-------|------------|----------|
| **Záře** | Modrá 🔵 | Červená 🔴 | Růžová 💗 |
| **Jídlo** | ✅ | ✅ | ✅ |
| **Útok** | ❌ | ✅ | ✅ |
| **Párování** | ❌ | ❌ | ✅ |
| **Kurzor** | ❌ | ✅ | ✅ |
| **Symbol** | 🍎 | ⚡ | ❤️ |
| **Rychlost** | 100% | 110% | 120% |

## 🎨 Balancing

Pro vyvážení hry stačí upravit hodnoty v `LifecycleConfig.js`:

```javascript
// Obtížnější přechod do aggressive
young_to_aggressive: {
    threshold: 0.8,  // Vyžaduje 80% velikosti
}

// Více zabití pro romantic
aggressive: {
    killsRequired: 6,  // Místo 4
}

// Rychlejší romantic fáze
romantic: {
    speedMultiplier: 1.5,  // 50% rychlejší
}
```

## 🐛 Debug

Zapnout debug mód:

```javascript
export const LIFECYCLE_SETTINGS = {
    debugMode: true,  // Výpisy do konzole
};
```

---

**Poznámka:** Veškeré změny v `LifecycleConfig.js` se automaticky projeví ve hře bez nutnosti měnit kód v `CuriousFishLayer.js`!

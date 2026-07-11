import React, { useState, useEffect, useMemo } from 'react';

// ===== Эйлиндар Вэйн — Pathfinder 1e Character Sheet =====
// Wizard 5 (Conjuration [Teleportation]) · Elf · Shattered Star
// Собран по статблоку 5-го уровня. Хранение: window.storage, ключ v5.

const STORAGE_KEY = "eilindar:character:v7";

const SCHOOLS = [
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation", "Universal",
];

const uid = () => Math.random().toString(36).slice(2, 10);

// Базовая таблица слотов волшебника (без бонусов от Int и школы), круги 1–9
const WIZ_SLOTS = {
  1: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [2, 1, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 2, 0, 0, 0, 0, 0, 0, 0],
  5: [3, 2, 1, 0, 0, 0, 0, 0, 0],
  6: [3, 3, 2, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 2, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 4, 3, 2, 1, 0, 0, 0, 0],
  10: [4, 4, 3, 3, 2, 0, 0, 0, 0],
};

// Бонусные заклинания от характеристики: floor((mod − круг)/4) + 1, если mod ≥ круг
const bonusSlots = (mod, circle) =>
  mod >= circle ? Math.floor((mod - circle) / 4) + 1 : 0;

const initialData = {
  name: "Эйлиндар Вэйн",
  race: "Эльф",
  className: "Wizard (Conjuration [Teleportation])",
  level: 5,
  alignment: "NG",
  size: "Средний",
  origin: "Маг из Магнимара, выпускник Камня Провидцев",

  str: 10, dex: 16, con: 14, int: 21, wis: 12, cha: 8,
  intNote: "база 19 (+1 ASI на L4) + Headband +2 = 21 · мод +5",

  hpCurrent: 34, hpMax: 34, hpNonlethal: 0,
  famHpCurrent: 17,

  bab: 2,
  fortBase: 1, refBase: 1, willBase: 4,
  saveResist: 1,             // Cloak of Resistance +1
  naturalArmor: 1,           // Amulet of Natural Armor +1
  deflection: 0,
  acMisc: 0,
  initMisc: 7,               // Scorpion +4 · Reactionary +2 · Cracked Dusty Rose Prism +1
  keenSenses: 2,
  speed: "30 ft",
  heroPoints: 1,
  gold: 2111,                // свободно на руках (BUDGET_FOOT). Крафт очереди 7 050 → дефицит ≈ 4 939, закрывается добычей

  specialistSchool: "Conjuration",
  subschool: "Teleportation",
  oppositionSchools: "Necromancy, Enchantment",
  spellFocusBonus: 2,        // Spell Focus +1 + Greater Spell Focus +1
  clVsSR: 2,                 // Elven Magic
  slotOverride: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, // 0 = авто по RAW

  buffs: { mageArmor: false, shield: false },
  shiftUsed: 0,

  traits: [
    { id: uid(), name: "Student of Philosophy", desc: "Int вместо Cha для Diplomacy и Bluff (логические / убеждающие проверки, не Intimidate). НЕ делает навыки класс-скиллами." },
    { id: uid(), name: "Reactionary", desc: "+2 trait bonus к Инициативе (учтён в +10)." },
  ],

  languages: ["Общий", "Эльфийский", "Драконий", "Тассилонский", "Небесный", "Сильван (+1 через Linguistics)"],

  feats: [
    { id: uid(), name: "Scribe Scroll", source: "Wizard 1 (бонусный)" },
    { id: uid(), name: "Spell Focus (Conjuration)", source: "Уровень 1 · +1 DC" },
    { id: uid(), name: "Greater Spell Focus (Conjuration)", source: "Уровень 3 · ещё +1 DC" },
    { id: uid(), name: "★ Craft Wand", source: "Wizard 5 (бонусный) · палочки за 50% цены. Цена = круг × CL × 750. Максимум 4-й круг, CL не выше своего (5). Проверка Spellcraft DC 5 + CL → для CL 5 это DC 10, take 10 = 23. Темп: 1 000 gp базовой цены в день. Без нужного заклинания в книге — DC +5 (всё ещё проходит)." },
  ],

  features: [
    { id: uid(), name: "Shift (Su) — Teleportation subschool", desc: "Swift action: телепорт до 10 ft, 8/день (3 + Int мод). Не провоцирует AoO, не теряешь Dex к AC, нужно видеть точку прибытия, свободна от угрожаемых зон." },
    { id: uid(), name: "Summoner's Charm (Su) — Conjuration", desc: "Длительность Conjuration (summoning) +2 раунда (½ уровня, мин. 1). Работает и на свитки summon monster." },
    { id: uid(), name: "Arcane Bond — Familiar (Scorpion)", desc: "См. вкладку «Фамильяр». Даёт +4 к Инициативе, empathic link, share spells, deliver touch spells, Alertness." },
    { id: uid(), name: "Elven Immunities", desc: "Иммунитет к магическому сну; +2 к сейвам vs Enchantment (Will +8 vs Charm/Compulsion)." },
    { id: uid(), name: "Elven Magic", desc: "+2 к проверке caster level против SR (CL 7 vs SR); +2 к Spellcraft на идентификацию (итого +15)." },
    { id: uid(), name: "Keen Senses", desc: "+2 расовый к Perception (учтён)." },
    { id: uid(), name: "Low-Light Vision", desc: "Видит при слабом свете вдвое дальше." },
    { id: uid(), name: "Silent Hunter", desc: "Нет штрафа −5 к Stealth при движении на нормальной скорости." },
    { id: uid(), name: "Wayfinder", desc: "Магический компас: постоянный continual flame (свет как свеча), указатель на предустановленную точку, слот под один ioun stone. Внутри — Cracked Dusty Rose Prism. При GM-адъюдикации некоторые кампании дают stone доп. resonance power — уточни у мастера." },
    { id: uid(), name: "Cracked Dusty Rose Prism (ioun stone)", desc: "+1 competence к Инициативе (в итоге +10). Обычно летает над головой; сейчас вложен в wayfinder — удобство и защита от sunder." },
  ],

  equipment: [
    { id: uid(), name: "Headband of Vast Intelligence +2", loc: "Голова", cost: "loot (≈4 000 экв., вне бюджета)", notes: "Int +2 · 3 бонусных ранга → Lore (Thassilon)" },
    { id: uid(), name: "Cloak of Resistance +1", loc: "Плечи", cost: "1 000", notes: "+1 ко всем сейвам" },
    { id: uid(), name: "Amulet of Natural Armor +1", loc: "Шея", cost: "2 000", notes: "+1 natural armor к КД" },
    { id: uid(), name: "Wayfinder", loc: "Пояс", cost: "500", notes: "continual flame · компас · слот под ioun stone" },
    { id: uid(), name: "Cracked Dusty Rose Prism", loc: "В слоте wayfinder", cost: "500", notes: "+1 competence к Инициативе" },
    { id: uid(), name: "Рапира", loc: "Пояс", cost: "20", notes: "+2 · 1d6 · 18–20/×2" },
    { id: uid(), name: "Лёгкий арбалет + 20 болтов", loc: "За спиной", cost: "36", notes: "+5 · 1d8 · 19–20/×2 · 80 ft" },
    { id: uid(), name: "Efficient Quiver", loc: "За спиной", cost: "1 800", notes: "3 палочки + место под жезл · достать = move action" },
    { id: uid(), name: "Spring-loaded Wrist Sheath (правая)", loc: "Правое запястье", cost: "5", notes: "свиток invisibility — free action, эмердженси эскейп" },
    { id: uid(), name: "Spring-loaded Wrist Sheath (левая)", loc: "Левое запястье", cost: "5", notes: "свиток summon monster III — free action, флэнкер без слота" },
    { id: uid(), name: "Bandolier", loc: "Пояс", cost: "1", notes: "alchemist's fire ×2, tanglefoot bag, запасной свиток" },
    { id: uid(), name: "Scroll cases ×3", loc: "На себе", cost: "3", notes: "остальные свитки" },
    { id: uid(), name: "Spellbook", loc: "На себе", cost: "—", notes: "кодекс заклинаний" },
    { id: uid(), name: "Spell component pouch", loc: "Пояс", cost: "—", notes: "" },
    { id: uid(), name: "Backpack", loc: "За спиной", cost: "—", notes: "" },
    { id: uid(), name: "Bag of holding ×2 (партийные)", loc: "У партии", cost: "—", notes: "тяжёлые запасы, дублирующие свитки, добыча" },
  ],

  consumables: [
    { id: uid(), name: "Палочка: Infernal Healing (CL 1)", cur: 50, max: 50, note: "в Efficient Quiver · fast healing 1, 1 мин · крафт 375 gp · CL выше бесполезен — эффект не растёт" },
    { id: uid(), name: "Палочка: Shield (CL 1)", cur: 50, max: 50, note: "в Efficient Quiver · +4 shield AC, 1 мин/заряд · крафт 375 gp · CL 1 достаточно, бой короче 5 минут" },
    { id: uid(), name: "Палочка: Mage Armor (CL 1)", cur: 50, max: 50, note: "в Efficient Quiver · 1 ч/заряд · крафт 375 gp · дубль — продать за 375 или отдать партии (палочка CL 5 сделана отдельно, апгрейда палочек в правилах нет)" },
    { id: uid(), name: "Палочка: Magic Missile (CL 5)", cur: 50, max: 50, note: "3 ракеты, 3d4+3 · автопопадание, без сейва · крафт 1 875 gp · высокий CL масштабирует эффект — главный аргумент" },
    { id: uid(), name: "Палочка: Cure Light Wounds (CL 1)", cur: 50, max: 50, note: "не из своего списка → Spellcraft DC 15, take 10 = 23 ✓ · крафт 375 gp · ⚠ согласовать с мастером" },
    { id: uid(), name: "Палочка: Comprehend Languages (CL 1)", cur: 50, max: 50, note: "тассилонские надписи в Lady's Light · крафт 375 gp" },
    { id: uid(), name: "Палочка: Mage Armor (CL 5)", cur: 50, max: 50, note: "в Efficient Quiver · 5 ч/заряд — один заряд на весь день · крафт 1 875 gp · цена за час та же, что у CL 1" },
    { id: uid(), name: "Палочка: Invisibility (CL 3)", cur: 50, max: 50, note: "2-й круг → минимум CL 3 · 3 мин/заряд · крафт 2 250 gp" },
    { id: uid(), name: "Свиток: Invisibility ×3", cur: 3, max: 3, note: "1 в правой wrist sheath (free action) · 450 gp за 3" },
    { id: uid(), name: "Свиток: Summon Monster III ×2", cur: 2, max: 2, note: "1 в левой wrist sheath · CL 5 · 750 gp за 2 · Summoner's Charm работает" },
    { id: uid(), name: "Свиток: Identify ×3", cur: 3, max: 3, note: "в scroll case · 75 gp за 3" },
    { id: uid(), name: "Свиток: Rope Trick ×2", cur: 2, max: 2, note: "Scribe Scroll · крафт 150 gp · убежище на отдых/подготовку" },
    { id: uid(), name: "Свиток: See Invisibility ×2", cur: 2, max: 2, note: "Scribe Scroll · крафт 150 gp · против невидимок" },
    { id: uid(), name: "Alchemist's fire ×2", cur: 2, max: 2, note: "в бандольере · 1d6 огня + splash" },
    { id: uid(), name: "Tanglefoot bag", cur: 1, max: 1, note: "в бандольере" },
  ],

  // status: "plan" | "wip" | "done"
  craftQueue: [
    { id: uid(), name: "Палочка: Magic Missile, CL 5", cost: "1 875", days: "4", status: "done", note: "изготовлено → в расходники · 3 ракеты, 3d4+3 · автопопадание, без сейва, без слота · главный аргумент за высокий CL" },
    { id: uid(), name: "Палочка: Cure Light Wounds, CL 1", cost: "375", days: "1", status: "done", note: "изготовлено → в расходники · не из своего списка → Spellcraft DC +5 = 15, take 10 = 23 ✓ · спросить мастера, разрешает ли" },
    { id: uid(), name: "Палочка: Comprehend Languages, CL 1", cost: "375", days: "1", status: "done", note: "изготовлено → в расходники · тассилонские надписи в Lady's Light" },
    { id: uid(), name: "Палочка: Mage Armor, CL 5 (апгрейд)", cost: "1 875", days: "4", status: "done", note: "изготовлено → в расходники · 5 ч/заряд — один заряд на весь день. Цена за час та же, что у CL 1" },
    { id: uid(), name: "Палочка: Invisibility, CL 3", cost: "2 250", days: "9", status: "done", note: "изготовлено → в расходники · 2-й круг → минимум CL 3 · 3 мин/заряд" },
    { id: uid(), name: "Свитки: Rope Trick ×2, See Invisibility ×2", cost: "300", days: "1", status: "done", note: "изготовлено → в расходники · Scribe Scroll · до 250 gp базовой цены — 2 часа на свиток" },
  ],

  spellbook: {
    cantrips: [
      { id: uid(), name: "Acid Splash", school: "Conjuration", prepared: true },
      { id: uid(), name: "Detect Magic", school: "Divination", prepared: true },
      { id: uid(), name: "Prestidigitation", school: "Universal", prepared: true },
      { id: uid(), name: "Dancing Lights", school: "Evocation", prepared: true },
      { id: uid(), name: "Resistance", school: "Abjuration", prepared: false },
      { id: uid(), name: "Detect Poison", school: "Divination", prepared: false },
      { id: uid(), name: "Read Magic", school: "Divination", prepared: false },
      { id: uid(), name: "Flare", school: "Evocation", prepared: false },
      { id: uid(), name: "Light", school: "Evocation", prepared: false },
      { id: uid(), name: "Ray of Frost", school: "Evocation", prepared: false },
      { id: uid(), name: "Ghost Sound", school: "Illusion", prepared: false },
      { id: uid(), name: "Bleed", school: "Necromancy", prepared: false },
      { id: uid(), name: "Disrupt Undead", school: "Necromancy", prepared: false },
      { id: uid(), name: "Touch of Fatigue", school: "Necromancy", prepared: false },
      { id: uid(), name: "Arcane Mark", school: "Universal", prepared: false },
      { id: uid(), name: "Mending", school: "Transmutation", prepared: false },
      { id: uid(), name: "Message", school: "Transmutation", prepared: false },
      { id: uid(), name: "Open/Close", school: "Transmutation", prepared: false },
      { id: uid(), name: "Mage Hand", school: "Transmutation", prepared: false },
    ],
    level1: [
      { id: uid(), name: "Mage Armor", school: "Conjuration", prepared: 1 },
      { id: uid(), name: "Grease", school: "Conjuration", prepared: 1 },
      { id: uid(), name: "Color Spray", school: "Illusion", prepared: 1 },
      { id: uid(), name: "Magic Missile", school: "Evocation", prepared: 1 },
      { id: uid(), name: "Shield", school: "Abjuration", prepared: 1 },
      { id: uid(), name: "Vanish", school: "Illusion", prepared: 0 },
      { id: uid(), name: "Feather Fall", school: "Transmutation", prepared: 0 },
      { id: uid(), name: "Identify", school: "Divination", prepared: 0 },
      { id: uid(), name: "Comprehend Languages", school: "Divination", prepared: 0 },
      { id: uid(), name: "True Strike", school: "Divination", prepared: 0 },
    ],
    level2: [
      { id: uid(), name: "Glitterdust", school: "Conjuration", prepared: 1 },
      { id: uid(), name: "Web", school: "Conjuration", prepared: 1 },
      { id: uid(), name: "Mirror Image", school: "Illusion", prepared: 1 },
      { id: uid(), name: "Invisibility", school: "Illusion", prepared: 1 },
      { id: uid(), name: "Create Pit", school: "Conjuration", prepared: 0 },
      { id: uid(), name: "Rope Trick", school: "Transmutation", prepared: 0 },
      { id: uid(), name: "See Invisibility", school: "Divination", prepared: 0 },
    ],
    level3: [
      { id: uid(), name: "Fireball", school: "Evocation", prepared: 1 },
      { id: uid(), name: "Haste", school: "Transmutation", prepared: 1 },
      { id: uid(), name: "Stinking Cloud", school: "Conjuration", prepared: 1 },
      { id: uid(), name: "Dispel Magic", school: "Abjuration", prepared: 0 },
    ],
  },

  // free: true — ранги от Headband, не считаются в пулах
  skills: [
    { id: uid(), name: "Acrobatics", abil: "dex", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Appraise", abil: "int", ranks: 0, bg: true, cs: true, free: false, note: "" },
    { id: uid(), name: "Bluff", abil: "int", ranks: 5, bg: false, cs: false, free: false, note: "Student of Phil: Int вместо Cha · не class-skill" },
    { id: uid(), name: "Climb", abil: "str", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Craft (Locks)", abil: "int", ranks: 0, bg: true, cs: true, free: false, note: "" },
    { id: uid(), name: "Diplomacy", abil: "int", ranks: 5, bg: false, cs: false, free: false, note: "Student of Phil: Int вместо Cha · не class-skill" },
    { id: uid(), name: "Disable Device", abil: "dex", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Disguise", abil: "cha", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Escape Artist", abil: "dex", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Fly", abil: "dex", ranks: 0, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Handle Animal", abil: "cha", ranks: 0, bg: true, cs: false, free: false, note: "" },
    { id: uid(), name: "Heal", abil: "wis", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Intimidate", abil: "cha", ranks: 0, bg: false, cs: false, free: false, note: "Student of Phil НЕ работает" },
    { id: uid(), name: "Knowledge (Arcana)", abil: "int", ranks: 5, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Dungeoneering)", abil: "int", ranks: 5, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Engineering)", abil: "int", ranks: 0, bg: true, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Geography)", abil: "int", ranks: 0, bg: true, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (History)", abil: "int", ranks: 5, bg: true, cs: true, free: false, note: "background skill" },
    { id: uid(), name: "Knowledge (Local)", abil: "int", ranks: 3, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Nature)", abil: "int", ranks: 0, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Nobility)", abil: "int", ranks: 0, bg: true, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Planes)", abil: "int", ranks: 5, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Knowledge (Religion)", abil: "int", ranks: 0, bg: false, cs: true, free: false, note: "" },
    { id: uid(), name: "Linguistics", abil: "int", ranks: 2, bg: true, cs: true, free: false, note: "background · +1 язык (Сильван)" },
    { id: uid(), name: "Lore (Thassilon)", abil: "int", ranks: 3, bg: true, cs: true, free: true, note: "3 бонусных ранга от Headband — вне пулов" },
    { id: uid(), name: "Perception", abil: "wis", ranks: 1, bg: false, cs: false, free: false, note: "+2 Keen Senses авто · +2 Alertness, когда скорпион в 5 ft → +6" },
    { id: uid(), name: "Perform", abil: "cha", ranks: 0, bg: true, cs: false, free: false, note: "" },
    { id: uid(), name: "Profession (Scribe)", abil: "wis", ranks: 1, bg: true, cs: true, free: false, note: "background skill" },
    { id: uid(), name: "Ride", abil: "dex", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Sense Motive", abil: "wis", ranks: 0, bg: false, cs: false, free: false, note: "+2 Alertness, когда скорпион в 5 ft" },
    { id: uid(), name: "Sleight of Hand", abil: "dex", ranks: 2, bg: true, cs: false, free: false, note: "background skill" },
    { id: uid(), name: "Spellcraft", abil: "int", ranks: 5, bg: false, cs: true, free: false, note: "+15 на identify (Elven Magic +2)" },
    { id: uid(), name: "Stealth", abil: "dex", ranks: 1, bg: false, cs: false, free: false, note: "нет штрафа за движение (Silent Hunter)" },
    { id: uid(), name: "Survival", abil: "wis", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Swim", abil: "str", ranks: 0, bg: false, cs: false, free: false, note: "" },
    { id: uid(), name: "Use Magic Device", abil: "cha", ranks: 0, bg: false, cs: false, free: false, note: "" },
  ],
};

// ===== Справочные блоки из статблока (только чтение) =====

const FAMILIAR = {
  title: "СКОРПИОН (Tiny) — Arcane Bond: Familiar",
  intro: "Всегда рядом — на плече, в кармане плаща, или в рюкзаке в бою.",
  master: [
    "+4 к Инициативе (scorpion racial) — учтено в +10",
    "Empathic link (до 1 мили)",
    "Share spells · Deliver touch spells",
    "Alertness: +2 к Perception и Sense Motive, пока фамильяр в пределах 5 ft",
  ],
  stats: [
    ["AC", "18"],
    ["HP", "17 (½ от макс. HP мастера)"],
    ["Сейвы", "Fort +2 · Ref +5 · Will +5"],
    ["Скорость", "30 ft, climb 20 ft"],
    ["Melee", "sting +5 (1d3−4 + яд: Fort DC 12, 1 Str/раунд, 6 раундов)"],
    ["Навыки", "Perception +8 · Stealth +18 · Climb +11"],
    ["Int", "8 — понимает язык мастера"],
    ["Особое", "empathic link, share spells, alertness, deliver touch spells, improved evasion"],
  ],
  death: "Смерть фамильяра: −200 XP × уровень мастера; Fort DC 15 или мастер умирает сам. Восстановление: 1 неделя + 200 gp × уровень.",
};

const BUDGET = [
  ["Спасение", "Cloak of Resistance +1, Amulet of NA +1", "3 000"],
  ["Палочки ✦", "Infernal Healing, Shield, Mage Armor (CL 1, ×50 зарядов) — крафт по 375", "1 125"],
  ["Свитки ✦", "3× Invisibility, 2× Summon Monster III, 3× Identify — Scribe Scroll", "1 275"],
  ["Хранение", "Efficient Quiver, Wrist Sheath ×2, Bandolier, Scroll Cases", "1 814"],
  ["Утилита", "Wayfinder + Cracked Dusty Rose Prism", "1 000"],
  ["Оружие", "Рапира, лёгкий арбалет + болты", "56"],
  ["Расходники", "Alchemist's fire ×2, Tanglefoot bag", "90"],
];

const BUDGET_FOOT = [
  ["Итого потрачено", "≈ 8 360 gp"],
  ["Возврат от Craft Wand", "+1 125 gp (палочки пересчитаны ретроспективно)"],
  ["Долг партии", "погашен (был ≈14 gp)"],
  ["Свободно в кармане", "≈ 2 111 gp"],
  ["Headband (loot)", "≈ 4 000 gp эквивалента, вне бюджета"],
  ["Всего заработано", "≈ 10 500 gp"],
];

// Справка по крафту — правила, которые ломают планы, если про них забыть
const CRAFT_REF = [
  ["Цена палочки", "круг × CL × 750 gp · крафт = половина"],
  ["Потолок", "4-й круг · CL не выше собственного (сейчас 5)"],
  ["Минимальный CL", "2-й круг → CL 3 · 3-й круг → CL 5"],
  ["Проверка", "Spellcraft DC 5 + CL · для CL 5 это DC 10 · take 10 = 23"],
  ["Нет заклинания в книге", "DC +5 · для тебя всё ещё проходит (CLW, божественка)"],
  ["Темп", "1 000 gp базовой цены в день · палочка CL 5 = 4 дня"],
  ["⚠ DC палочки", "фиксированный, БЕЗ Spell Focus и Greater. Палочка glitterdust = DC 13 против твоих 19. Save-or-suck — только из слотов"],
  ["Свитки (Scribe Scroll)", "половина цены · до 250 gp базовой — 2 часа · дороже — 1 день · каждый свиток съедает подготовленный слот того же круга"],
];

const NEXT_BUYS = [
  ["1", "Belt of Incredible Dexterity +2", "4 000 → 2 000", "Dex 18: +1 AC, +1 Ref, +1 к дальнему бою, Инициатива +11 · попросить партийца с Craft Wondrous"],
  ["2", "Metamagic Rod of Extend, Lesser", "3 000 gp", "Extend 3/день на 1–3 круг, без повышения слота"],
  ["3", "Ioun Stone: Pearly White Spindle (cracked)", "500 → 250", "Регенерация 1 hp/час · тоже wondrous"],
];

const TACTICS = [
  {
    title: "Экономия действий (раунд целиком)",
    lines: [
      "Free action — достать свиток из wrist sheath (правая или левая)",
      "Swift action — Shift (10 ft телепорт) ИЛИ активировать метамагию",
      "Standard action — кастовать заклинание ИЛИ читать свиток",
      "Move action — переместиться ИЛИ достать палочку из quiver",
      "Итог: заклинание + свиток + перемещение + Shift — всё за один раунд.",
    ],
  },
  {
    title: "Против толпы",
    lines: [
      "Раунд 1: fireball (5d6, 20-ft radius, Reflex DC 18) — сносишь миньонов",
      "Раунд 2: если кто-то жив — stinking cloud (Fort DC 20, nauseated) → Shift на 10 ft прочь",
      "Раунд 3: mirror image, если что-то долетело; иначе haste на группу",
    ],
  },
  {
    title: "Против одиночного босса",
    lines: [
      "Раунд 1: glitterdust (Will DC 19) — слепота и раскрытие невидимости → Shift в тыл",
      "Раунд 2: haste себе и союзникам → free action достать свиток SM III → standard кастовать = флэнкер",
      "Раунд 3: mirror image, если босс близко; magic missile на добивание",
    ],
  },
  {
    title: "Эмердженси эскейп",
    lines: [
      "Free — достать свиток invisibility из wrist sheath",
      "Standard — кастовать invisibility",
      "Swift — Shift на 10 ft прочь",
      "Move — отойти ещё на 30 ft",
      "Итог: 40 ft от угрозы, невидим, за один раунд",
    ],
  },
  {
    title: "Экономия слотов",
    lines: [
      "Утро: палочка mage armor (1 заряд = 1 час при CL 1)",
      "Под угрозой: палочка shield (+4 shield AC, 1 мин/заряд)",
      "Лечение: палочка infernal healing (1 hp/раунд × 10 раундов)",
      "Позиционирование: свиток invisibility в правой wrist sheath",
    ],
  },
];

const LEVELUP = [
  "HP 22 → 34 (+12 за два уровня)",
  "BAB +1 → +2",
  "Плохие сейвы почти не выросли, но Cloak of Resistance +1 дал +1 ко всем (Fort +4, Ref +5, Will +6)",
  "ASI на L4 → Int base 18 → 19 (с Headband 21; мод остаётся +5, задел на +6 к 8-му)",
  "Wizard bonus feat на L5 → Craft Wand (партии не нужны магические оружие и броня; Craft Wondrous закрыт другим игроком)",
  "Три купленные палочки пересчитаны на крафтовую цену: 2 250 → 1 125 gp, вернулось 1 125",
  "Слоты: 1-й круг 4 → 5, 2-й 3 → 4, 3-й круг новый — 3 слота",
  "Concentration +8 → +10",
  "DC Conjuration 3-го круга = 20",
  "Скиллпоинты: +14 adv (Bluff 0→5, Diplomacy 3→5, K.Arcana/Dungeoneering/Planes/Spellcraft до 5, Perception 0→1) · +4 bg (K.History 3→5, Linguistics 1→2, Sleight of Hand 1→2)",
  "Книга: +4 бесплатных на L4–L5 (rope trick, see invisibility, fireball, stinking cloud); списаны со свитков и чужих книг haste, dispel magic",
  "Инициатива +3 → +10 (Scorpion +4, Reactionary +2, Cracked Dusty Rose Prism +1)",
  "Arcane Bond: familiar (скорпион) — отдельная вкладка",
];

// ===== Theme =====
const T = {
  bgParch: "#f4e8cf",
  bgCard: "#fbf3df",
  bgDeep: "#eadfc3",
  border: "#8b4513",
  borderLight: "#c9a876",
  rust: "#a0522d",
  rustDeep: "#7a3c1a",
  forest: "#2f4a2a",
  ink: "#3a2418",
  gold: "#b8842f",
  muted: "#7a6a54",
  conj: "#f3dfc2",
};

const fontSerif = "'EB Garamond', Georgia, serif";
const fontDisplay = "'Cinzel', 'Trajan Pro', serif";

const mod = (s) => Math.floor((Number(s) - 10) / 2);
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

// "1 875" / "1,875 gp" → 1875. Для подсчёта разрыва бюджета по строковым ценам.
const parseGp = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
const fmtGp = (n) => n.toLocaleString("ru-RU");

// Свободно на руках на момент хэндоффа (BUDGET_FOOT). Крафт очереди сверяется с этим.
const GOLD_FREE_BEFORE = 2111;

// ===== Мелкие UI-компоненты (вне основного — иначе инпуты теряют фокус) =====

const Lbl = ({ children }) => (
  <div style={{ fontFamily: fontDisplay, fontSize: 9, letterSpacing: 1.5, color: T.muted, textTransform: "uppercase", fontWeight: 600 }}>{children}</div>
);

const ParchInput = ({ value, onChange, type = "text", align = "left" }) => (
  <input
    type={type} value={value ?? ""}
    onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
    style={{
      width: "100%", padding: "4px 6px", background: T.bgCard,
      border: `1px solid ${T.borderLight}`, borderRadius: 2,
      fontFamily: fontSerif, fontSize: 14, color: T.ink, textAlign: align,
    }}
  />
);

const IconBtn = ({ onClick, children, title, color = T.rust }) => (
  <button onClick={onClick} title={title} style={{
    width: 22, height: 22, padding: 0,
    border: `1px solid ${T.borderLight}`, background: T.bgCard,
    cursor: "pointer", color, fontFamily: fontDisplay, fontWeight: 700,
    fontSize: 13, borderRadius: 2, lineHeight: 1,
  }}>{children}</button>
);

const Stat = ({ label, value, sub, accent }) => (
  <div style={{
    flex: 1, minWidth: 84, background: accent ? T.conj : T.bgParch,
    border: `1px solid ${accent ? T.rust : T.borderLight}`,
    padding: "6px 8px", textAlign: "center", borderRadius: 2,
  }}>
    <div style={{ fontSize: 9, fontFamily: fontDisplay, letterSpacing: 1.5, color: T.rustDeep, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 24, fontFamily: fontSerif, color: T.ink, fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{sub}</div>}
  </div>
);

function SectionBox({ title, right, children }) {
  return (
    <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 4, marginBottom: 12, boxShadow: "0 1px 0 rgba(139,69,19,0.25)" }}>
      <div style={{
        padding: "6px 12px",
        background: `linear-gradient(to bottom, ${T.rust}, ${T.rustDeep})`,
        color: T.bgParch, fontFamily: fontDisplay, fontSize: 12, letterSpacing: 2,
        textTransform: "uppercase", fontWeight: 700,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      }}>
        <span>{title}</span>
        {right && <span style={{ fontFamily: fontSerif, fontSize: 11, fontStyle: "italic", letterSpacing: 0.5, textTransform: "none", opacity: 0.95 }}>{right}</span>}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function SpellTier({ title, stats, dcLine, spells, isLeveled, specialistSchool, oppositionSchools, onUpdate, onRemove, newSpell, setNewSpell, onAdd }) {
  const oppSet = oppositionSchools.split(",").map(s => s.trim().toLowerCase());

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4,
        padding: "6px 10px",
        background: `linear-gradient(to bottom, ${T.rust}, ${T.rustDeep})`,
        color: T.bgParch, fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1.5,
        fontWeight: 700, borderRadius: "3px 3px 0 0",
      }}>
        <span>{title}</span>
        <span style={{ fontSize: 11, opacity: 0.92, fontFamily: fontSerif, fontStyle: "italic", letterSpacing: 0.5 }}>{stats}</span>
      </div>

      {dcLine && (
        <div style={{ padding: "4px 10px", background: T.bgDeep, border: `1px solid ${T.borderLight}`, borderTop: "none", fontSize: 11, color: T.rustDeep, fontStyle: "italic" }}>
          {dcLine}
        </div>
      )}

      <div style={{ padding: 8, background: T.bgParch, border: `1px solid ${T.borderLight}`, borderTop: "none", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input placeholder="название заклинания"
          value={newSpell.name}
          onChange={(e) => setNewSpell({ ...newSpell, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
          style={{ flex: 2, minWidth: 160, padding: "4px 6px", background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 13 }} />
        <select value={newSpell.school}
          onChange={(e) => setNewSpell({ ...newSpell, school: e.target.value })}
          style={{ padding: "4px 6px", background: T.bgCard, border: `1px solid ${T.borderLight}`, fontFamily: fontSerif, fontSize: 13 }}>
          {SCHOOLS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={onAdd} style={{
          padding: "5px 16px", background: T.forest, color: "#fff", border: "none",
          borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1,
        }}>+ ДОБАВИТЬ</button>
      </div>

      {spells.length === 0 ? (
        <div style={{ padding: 12, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderTop: "none", fontSize: 12, color: T.muted, fontStyle: "italic", textAlign: "center" }}>
          Книга пуста — добавь заклинания выше
        </div>
      ) : (
        <table className="sheet-table" style={{ fontSize: 13 }}>
          <tbody>
            {spells.map(s => {
              const isConj = s.school === specialistSchool;
              const isOpp = oppSet.includes((s.school || "").toLowerCase());
              const isPrepared = isLeveled ? (s.prepared > 0) : !!s.prepared;
              return (
                <tr key={s.id} style={{
                  background: isConj ? T.conj : T.bgCard,
                  borderBottom: `1px solid ${T.borderLight}`,
                  opacity: isOpp ? 0.55 : 1,
                }}>
                  <td style={{ padding: "4px 8px", width: 74, textAlign: "center" }}>
                    {isLeveled ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <button onClick={() => onUpdate(s.id, { prepared: Math.max(0, (s.prepared || 0) - 1) })}
                          style={{ width: 20, height: 20, border: `1px solid ${T.borderLight}`, background: T.bgCard, cursor: "pointer", fontWeight: 700, padding: 0, borderRadius: 2 }}>−</button>
                        <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700, color: isPrepared ? T.rust : T.muted, fontFamily: fontDisplay }}>
                          {s.prepared || 0}
                        </span>
                        <button onClick={() => onUpdate(s.id, { prepared: (s.prepared || 0) + 1 })}
                          style={{ width: 20, height: 20, border: `1px solid ${T.borderLight}`, background: T.bgCard, cursor: "pointer", fontWeight: 700, padding: 0, borderRadius: 2 }}>+</button>
                      </div>
                    ) : (
                      <input type="checkbox" checked={!!s.prepared}
                        onChange={(e) => onUpdate(s.id, { prepared: e.target.checked })}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    )}
                  </td>
                  <td style={{ padding: "4px 8px", fontWeight: isPrepared ? 700 : 400 }}>
                    <input value={s.name} onChange={(e) => onUpdate(s.id, { name: e.target.value })}
                      style={{ background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 13, width: "100%", fontWeight: "inherit", color: T.ink, padding: 0 }}
                    />
                  </td>
                  <td style={{ padding: "4px 8px", width: 150 }}>
                    <select value={s.school} onChange={(e) => onUpdate(s.id, { school: e.target.value })}
                      style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 12, color: isConj ? T.rust : (isOpp ? "#a33" : T.muted), fontStyle: "italic", cursor: "pointer" }}>
                      {SCHOOLS.map(sc => <option key={sc}>{sc}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "4px 8px", width: 80, fontSize: 10, color: T.muted, fontStyle: "italic" }}>
                    {isConj && "★ школа"}
                    {isOpp && "× запр."}
                  </td>
                  <td style={{ padding: 4, width: 28, textAlign: "center" }}>
                    <button onClick={() => onRemove(s.id)} title="Удалить"
                      style={{ width: 22, height: 22, border: `1px solid ${T.borderLight}`, background: T.bgCard, cursor: "pointer", color: "#a33", fontWeight: 700, padding: 0, borderRadius: 2 }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EditableList({ title, color, items, fields, onAdd, onUpdate, onRemove }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700 }}>{title}</div>
        <button onClick={onAdd} style={{
          padding: "3px 10px", background: T.forest, color: "#fff", border: "none",
          borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
        }}>+ ДОБАВИТЬ</button>
      </div>
      {items.map(it => (
        <div key={it.id} style={{
          background: T.bgParch, border: `1px solid ${T.borderLight}`,
          padding: "8px 10px", marginBottom: 6, borderLeft: `3px solid ${color}`,
          position: "relative",
        }}>
          {fields.map((f, fi) => {
            const commonStyle = {
              width: "calc(100% - 30px)",
              background: "transparent", border: "none",
              fontFamily: fontSerif,
              fontSize: f.small ? 11 : 13,
              fontWeight: f.bold ? 700 : 400,
              fontStyle: f.italic ? "italic" : "normal",
              color: f.italic || f.small ? T.muted : T.ink,
              padding: 0,
              marginTop: fi === 0 ? 0 : 2,
              display: "block",
            };
            if (f.textarea) {
              return (
                <textarea key={f.key} placeholder={f.placeholder}
                  value={it[f.key] || ""}
                  onChange={(e) => onUpdate(it.id, { [f.key]: e.target.value })}
                  rows={2}
                  style={{ ...commonStyle, resize: "vertical", fontFamily: fontSerif }}
                />
              );
            }
            return (
              <input key={f.key} placeholder={f.placeholder}
                value={it[f.key] || ""}
                onChange={(e) => onUpdate(it.id, { [f.key]: e.target.value })}
                style={commonStyle}
              />
            );
          })}
          <button onClick={() => onRemove(it.id)} title="Удалить"
            style={{
              position: "absolute", right: 4, top: 4,
              width: 22, height: 22, border: `1px solid ${T.borderLight}`,
              background: T.bgCard, cursor: "pointer", color: "#a33", fontWeight: 700,
              padding: 0, borderRadius: 2,
            }}>×</button>
        </div>
      ))}
    </div>
  );
}

function AddLang({ onAdd }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input placeholder="+ язык" value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onAdd(v); setV(""); } }}
        style={{ flex: 1, padding: "3px 6px", background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 2, fontFamily: fontSerif, fontSize: 12 }}
      />
      <button onClick={() => { onAdd(v); setV(""); }}
        style={{ padding: "3px 10px", background: T.forest, color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 11 }}>+</button>
    </div>
  );
}

// ===== Основной компонент =====

export default function CharacterSheet() {
  const [c, setC] = useState(initialData);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [activeTab, setActiveTab] = useState("skills");
  const [newSpell, setNewSpell] = useState({
    cantrips: { name: "", school: "Conjuration" },
    level1: { name: "", school: "Conjuration" },
    level2: { name: "", school: "Conjuration" },
    level3: { name: "", school: "Conjuration" },
  });
  const [newSkill, setNewSkill] = useState({ name: "", abil: "int", bg: false, cs: false });

  // Загрузка
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const r = await window.storage.get(STORAGE_KEY);
          if (r && r.value && mounted) {
            const parsed = JSON.parse(r.value);
            setC({ ...initialData, ...parsed });
          }
        }
      } catch (e) { /* первый запуск или нет хранилища */ }
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Автосохранение
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("…");
    const t = setTimeout(async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          await window.storage.set(STORAGE_KEY, JSON.stringify(c));
          setSaveStatus("✓ сохранено");
          setTimeout(() => setSaveStatus(""), 1500);
        } else {
          setSaveStatus("локально");
          setTimeout(() => setSaveStatus(""), 1500);
        }
      } catch (e) {
        setSaveStatus("⚠ не сохранилось — попробуй ещё раз");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [c, loaded]);

  const abMods = {
    str: mod(c.str), dex: mod(c.dex), con: mod(c.con),
    int: mod(c.int), wis: mod(c.wis), cha: mod(c.cha),
  };

  const derived = useMemo(() => {
    const m = abMods;
    const armor = c.buffs?.mageArmor ? 4 : 0;   // mage armor
    const shield = c.buffs?.shield ? 4 : 0;     // shield
    const nat = Number(c.naturalArmor) || 0;
    const defl = Number(c.deflection) || 0;
    const misc = Number(c.acMisc) || 0;

    const ac = 10 + m.dex + nat + defl + misc + armor + shield;
    const acTouch = 10 + m.dex + defl + misc;
    const acFlat = 10 + nat + defl + misc + armor + shield;

    return {
      ac, acTouch, acFlat,
      acBase: 10 + m.dex + nat + defl + misc,
      cmd: 10 + c.bab + m.str + m.dex + defl,
      fcmd: 10 + c.bab + m.str + defl,
      init: m.dex + (Number(c.initMisc) || 0),
      mab: c.bab + m.str, rab: c.bab + m.dex, cmb: c.bab + m.str,
      fort: c.fortBase + m.con + (Number(c.saveResist) || 0),
      ref: c.refBase + m.dex + (Number(c.saveResist) || 0),
      will: c.willBase + m.wis + (Number(c.saveResist) || 0),
      casterLevel: c.level,
      clVsSR: c.level + (Number(c.clVsSR) || 0),
      concentration: c.level + m.int,
      cantripsPerDay: c.level >= 2 ? 4 : 3,
      shiftPerDay: 3 + m.int,
      charmRounds: Math.max(1, Math.floor(c.level / 2)),
      dc: (circle) => 10 + circle + m.int,
      dcConj: (circle) => 10 + circle + m.int + (Number(c.spellFocusBonus) || 0),
    };
  }, [c, abMods]);

  // Слоты по кругам: база (таблица) + Int + школа, с ручным override
  const slots = useMemo(() => {
    const table = WIZ_SLOTS[Math.min(10, Math.max(1, c.level))] || WIZ_SLOTS[1];
    const out = {};
    [1, 2, 3, 4, 5].forEach(circle => {
      const base = table[circle - 1] || 0;
      if (base === 0) { out[circle] = null; return; }
      const int = bonusSlots(abMods.int, circle);
      const school = 1;
      const auto = base + int + school;
      const ov = Number(c.slotOverride?.[circle]) || 0;
      out[circle] = { base, int, school, auto, total: ov > 0 ? ov : auto, override: ov };
    });
    return out;
  }, [c.level, c.slotOverride, abMods.int]);

  const pools = useMemo(() => {
    const advPerLvl = 2 + abMods.int;
    const advAvail = advPerLvl * c.level;
    const bgAvail = 2 * c.level;
    let advUsed = 0, bgUsed = 0;
    c.skills.forEach(s => {
      if (s.free) return;              // ранги от Headband — вне пулов
      if (s.bg) bgUsed += s.ranks; else advUsed += s.ranks;
    });
    return { advAvail, bgAvail, advUsed, bgUsed };
  }, [c.skills, c.level, abMods.int]);

  // Разрыв бюджета: сумма крафта очереди против свободного золота на руках
  const craftTotal = useMemo(
    () => c.craftQueue.reduce((a, it) => a + parseGp(it.cost), 0),
    [c.craftQueue]
  );

  const prepStats = useMemo(() => ({
    cantripsP: c.spellbook.cantrips.filter(s => s.prepared).length,
    l1P: c.spellbook.level1.reduce((a, s) => a + (s.prepared || 0), 0),
    l2P: c.spellbook.level2.reduce((a, s) => a + (s.prepared || 0), 0),
    l3P: c.spellbook.level3.reduce((a, s) => a + (s.prepared || 0), 0),
  }), [c.spellbook]);

  // Мутации
  const update = (field, val) => setC(p => ({ ...p, [field]: val }));
  const updateNum = (field, val) => setC(p => ({ ...p, [field]: Number(val) || 0 }));
  const bumpGold = (delta) => setC(p => ({ ...p, gold: (Number(p.gold) || 0) + delta }));
  const toggleBuff = (k) => setC(p => ({ ...p, buffs: { ...p.buffs, [k]: !p.buffs?.[k] } }));
  const setOverride = (circle, val) => setC(p => ({
    ...p, slotOverride: { ...p.slotOverride, [circle]: Math.max(0, Number(val) || 0) }
  }));

  const bumpSkill = (id, delta) => setC(p => ({
    ...p,
    skills: p.skills.map(s => s.id === id
      ? { ...s, ranks: Math.max(0, Math.min(p.level, s.ranks + delta)) }
      : s)
  }));

  const setSkillRanks = (id, val) => setC(p => ({
    ...p,
    skills: p.skills.map(s => s.id === id
      ? { ...s, ranks: Math.max(0, Math.min(p.level, Number(val) || 0)) }
      : s)
  }));

  const toggleSkillCS = (id) => setC(p => ({
    ...p, skills: p.skills.map(s => s.id === id ? { ...s, cs: !s.cs } : s)
  }));

  const updateSkillField = (id, field, value) => setC(p => ({
    ...p, skills: p.skills.map(s => s.id === id ? { ...s, [field]: value } : s)
  }));

  const addCustomSkill = () => {
    if (!newSkill.name.trim()) return;
    setC(p => ({
      ...p,
      skills: [...p.skills, { id: uid(), name: newSkill.name, abil: newSkill.abil, ranks: 0, bg: newSkill.bg, cs: newSkill.cs, free: false, note: "" }]
    }));
    setNewSkill({ name: "", abil: "int", bg: false, cs: false });
  };

  const removeSkill = (id) => setC(p => ({ ...p, skills: p.skills.filter(s => s.id !== id) }));

  const addSpell = (tier) => {
    const s = newSpell[tier];
    if (!s.name.trim()) return;
    const entry = tier === "cantrips"
      ? { id: uid(), name: s.name, school: s.school, prepared: false }
      : { id: uid(), name: s.name, school: s.school, prepared: 0 };
    setC(p => ({ ...p, spellbook: { ...p.spellbook, [tier]: [...p.spellbook[tier], entry] } }));
    setNewSpell(p => ({ ...p, [tier]: { name: "", school: s.school } }));
  };

  const removeSpell = (tier, id) => setC(p => ({
    ...p, spellbook: { ...p.spellbook, [tier]: p.spellbook[tier].filter(s => s.id !== id) }
  }));

  const updateSpell = (tier, id, patch) => setC(p => ({
    ...p, spellbook: { ...p.spellbook, [tier]: p.spellbook[tier].map(s => s.id === id ? { ...s, ...patch } : s) }
  }));

  const addItem = (key, template) => setC(p => ({ ...p, [key]: [...p[key], { id: uid(), ...template }] }));
  const updateItem = (key, id, patch) => setC(p => ({ ...p, [key]: p[key].map(it => it.id === id ? { ...it, ...patch } : it) }));
  const removeItem = (key, id) => setC(p => ({ ...p, [key]: p[key].filter(it => it.id !== id) }));

  const bumpCons = (id, delta) => setC(p => ({
    ...p,
    consumables: p.consumables.map(it => it.id === id
      ? { ...it, cur: Math.max(0, Math.min(Number(it.max) || 99, (Number(it.cur) || 0) + delta)) }
      : it)
  }));
  const refillCons = () => setC(p => ({ ...p, consumables: p.consumables.map(it => ({ ...it, cur: Number(it.max) || 0 })) }));

  const CRAFT_CYCLE = { plan: "wip", wip: "done", done: "plan" };
  const cycleCraft = (id) => setC(p => ({
    ...p,
    craftQueue: p.craftQueue.map(it => it.id === id ? { ...it, status: CRAFT_CYCLE[it.status] || "plan" } : it)
  }));

  const addLang = (v) => { if (v.trim()) setC(p => ({ ...p, languages: [...p.languages, v] })); };
  const removeLang = (i) => setC(p => ({ ...p, languages: p.languages.filter((_, idx) => idx !== i) }));

  const restDay = () => {
    setC(p => ({ ...p, shiftUsed: 0, buffs: { mageArmor: false, shield: false } }));
  };

  const exportJson = () => {
    const data = JSON.stringify(c, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data).then(() => {
        setSaveStatus("✓ JSON в буфере");
        setTimeout(() => setSaveStatus(""), 2000);
      });
    }
  };

  const resetAll = () => {
    if (window.confirm("Сбросить лист к статблоку 5-го уровня?")) setC(initialData);
  };

  const skillTotal = (s) => {
    let total = s.ranks + abMods[s.abil] + (s.cs && s.ranks > 0 ? 3 : 0);
    if (s.name === "Perception") total += c.keenSenses;
    return total;
  };

  if (!loaded) {
    return <div style={{ padding: 40, fontFamily: fontSerif, color: T.muted, textAlign: "center" }}>Загрузка листа…</div>;
  }

  const shiftLeft = derived.shiftPerDay - (c.shiftUsed || 0);
  const famHpMax = Math.floor(c.hpMax / 2);

  return (
    <div style={{ minHeight: "100vh", background: T.bgParch, padding: 16, fontFamily: fontSerif, color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        input:focus, select:focus, button:focus, textarea:focus { outline: 2px solid ${T.gold}; outline-offset: 1px; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .sheet-table { width: 100%; border-collapse: collapse; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{
          background: `linear-gradient(135deg, ${T.rustDeep} 0%, ${T.rust} 50%, #c87a3a 100%)`,
          color: T.bgParch, padding: "18px 22px", borderRadius: "6px 6px 0 0",
          border: `2px solid ${T.border}`, borderBottom: "none",
          display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center",
        }}>
          <div>
            <input type="text" value={c.name} onChange={(e) => update("name", e.target.value)}
              style={{
                background: "transparent", border: "none", color: T.bgParch,
                fontFamily: fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: 3,
                width: "100%", padding: 0,
              }} />
            <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.95, fontStyle: "italic" }}>
              {c.race} · {c.className} · Уровень {c.level} · {c.alignment} · Shattered Star
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, fontStyle: "italic", marginTop: 2 }}>{c.origin}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, letterSpacing: 1 }}>
            <div style={{ opacity: 0.85 }}>HERO POINTS</div>
            <input type="number" value={c.heroPoints} onChange={(e) => updateNum("heroPoints", e.target.value)}
              style={{
                background: "transparent", border: "none", color: T.bgParch,
                fontFamily: fontDisplay, fontSize: 28, fontWeight: 700,
                width: 50, textAlign: "right", padding: 0,
              }} />
          </div>
          <div style={{ textAlign: "right", fontSize: 11, letterSpacing: 1 }}>
            <div style={{ opacity: 0.85 }}>ЗОЛОТО · GP</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 }}>
              <button onClick={() => bumpGold(-100)} title="−100 gp" style={{
                width: 22, height: 22, padding: 0, border: `1px solid ${T.bgParch}`,
                background: "rgba(244,232,207,0.15)", color: T.bgParch, cursor: "pointer",
                fontFamily: fontDisplay, fontWeight: 700, fontSize: 13, borderRadius: 2, lineHeight: 1,
              }}>−</button>
              <input type="number" value={c.gold} onChange={(e) => updateNum("gold", e.target.value)}
                style={{
                  background: "transparent", border: "none", color: T.bgParch,
                  fontFamily: fontDisplay, fontSize: 26, fontWeight: 700,
                  width: 82, textAlign: "right", padding: 0,
                }} />
              <button onClick={() => bumpGold(100)} title="+100 gp" style={{
                width: 22, height: 22, padding: 0, border: `1px solid ${T.bgParch}`,
                background: "rgba(244,232,207,0.15)", color: T.bgParch, cursor: "pointer",
                fontFamily: fontDisplay, fontWeight: 700, fontSize: 13, borderRadius: 2, lineHeight: 1,
              }}>+</button>
            </div>
            <div style={{ opacity: 0.75, fontSize: 9, fontStyle: "italic", marginTop: 1 }}>±100 · впиши точную сумму</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", fontSize: 10 }}>
            <button onClick={restDay} style={{
              background: "rgba(244,232,207,0.15)", color: T.bgParch,
              border: `1px solid ${T.bgParch}`, padding: "4px 10px", borderRadius: 2,
              cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
            }}>НОВЫЙ ДЕНЬ</button>
            <button onClick={exportJson} style={{
              background: "rgba(244,232,207,0.15)", color: T.bgParch,
              border: `1px solid ${T.bgParch}`, padding: "4px 10px", borderRadius: 2,
              cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
            }}>КОПИРОВАТЬ JSON</button>
            <button onClick={resetAll} style={{
              background: "rgba(244,232,207,0.15)", color: T.bgParch,
              border: `1px solid ${T.bgParch}`, padding: "4px 10px", borderRadius: 2,
              cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
            }}>СБРОС</button>
            <div style={{ opacity: 0.85, minHeight: 14, fontStyle: "italic", fontFamily: fontSerif, fontSize: 11 }}>
              {saveStatus || "\u00a0"}
            </div>
          </div>
        </div>

        {/* Identity row */}
        <div style={{
          background: T.bgCard, border: `2px solid ${T.border}`, borderTop: "none",
          padding: "10px 16px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12, marginBottom: 14,
        }}>
          <div><Lbl>Раса</Lbl><ParchInput value={c.race} onChange={(v) => update("race", v)} /></div>
          <div><Lbl>Класс</Lbl><ParchInput value={c.className} onChange={(v) => update("className", v)} /></div>
          <div><Lbl>Уровень</Lbl><ParchInput type="number" value={c.level} onChange={(v) => update("level", v)} align="center" /></div>
          <div><Lbl>Мировоззрение</Lbl><ParchInput value={c.alignment} onChange={(v) => update("alignment", v)} /></div>
          <div><Lbl>Размер</Lbl><ParchInput value={c.size} onChange={(v) => update("size", v)} /></div>
          <div><Lbl>Скорость</Lbl><ParchInput value={c.speed} onChange={(v) => update("speed", v)} align="center" /></div>
        </div>

        {/* Abilities + HP */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 12 }}>
          <SectionBox title="Характеристики" right={c.intNote}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {[
                { k: "str", l: "СИЛ" }, { k: "dex", l: "ЛВК" }, { k: "con", l: "ТЕЛ" },
                { k: "int", l: "ИНТ" }, { k: "wis", l: "МДР" }, { k: "cha", l: "ХАР" },
              ].map(({ k, l }) => (
                <div key={k} style={{ background: k === "int" ? T.conj : T.bgParch, border: `1px solid ${k === "int" ? T.rust : T.borderLight}`, borderRadius: 3, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontFamily: fontDisplay, letterSpacing: 2, color: T.rustDeep, fontWeight: 700, marginBottom: 2 }}>{l}</div>
                  <input type="number" value={c[k]} onChange={(e) => updateNum(k, e.target.value)}
                    style={{
                      width: "100%", background: "transparent", border: "none", textAlign: "center",
                      fontFamily: fontSerif, fontSize: 26, color: T.ink, fontWeight: 600, padding: 0,
                    }} />
                  <div style={{ fontSize: 16, color: T.rust, fontWeight: 700, fontFamily: fontDisplay, borderTop: `1px dotted ${T.borderLight}`, marginTop: 2, paddingTop: 2 }}>
                    {sign(abMods[k])}
                  </div>
                </div>
              ))}
            </div>
          </SectionBox>

          <SectionBox title="Жизнь">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Lbl>Текущие</Lbl>
                <ParchInput type="number" value={c.hpCurrent} onChange={(v) => update("hpCurrent", v)} align="center" />
              </div>
              <span style={{ fontSize: 24, color: T.muted, marginTop: 14 }}>/</span>
              <div style={{ flex: 1 }}>
                <Lbl>Макс</Lbl>
                <ParchInput type="number" value={c.hpMax} onChange={(v) => update("hpMax", v)} align="center" />
              </div>
              <div style={{ flex: 1 }}>
                <Lbl>Нелет.</Lbl>
                <ParchInput type="number" value={c.hpNonlethal} onChange={(v) => update("hpNonlethal", v)} align="center" />
              </div>
            </div>
            <div style={{ marginTop: 8, background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: "6px 8px", fontSize: 11, color: T.muted, fontStyle: "italic" }}>
              HD {c.level}d6 · BAB {sign(c.bab)} · сейвы база {c.fortBase}/{c.refBase}/{c.willBase} + {c.saveResist} (Cloak)<br />
              Иммунитет к магическому сну · +2 vs Enchantment
            </div>
          </SectionBox>
        </div>

        {/* Combat */}
        <SectionBox title="Боевые показатели" right={`Инициатива ${sign(derived.init)} · Dex ${sign(abMods.dex)} + Scorpion +4 + Reactionary +2 + Ioun +1`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Stat label="КД" value={derived.ac} sub={`10 + Dex ${sign(abMods.dex)} + NA ${c.naturalArmor}${c.buffs?.mageArmor ? " + 4 armor" : ""}${c.buffs?.shield ? " + 4 shield" : ""}`} accent={c.buffs?.mageArmor || c.buffs?.shield} />
            <Stat label="Касание" value={derived.acTouch} />
            <Stat label="Застигнут" value={derived.acFlat} />
            <Stat label="CMD" value={derived.cmd} sub="10+BAB+Str+Dex" />
            <Stat label="Flat CMD" value={derived.fcmd} />
            <Stat label="Инициатива" value={sign(derived.init)} accent />
            <Stat label="Скорость" value={c.speed} />
            <Stat label="BAB" value={sign(c.bab)} />
          </div>

          {/* Buffs + Shift */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, borderRadius: 3 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>БАФФЫ КД</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { k: "mageArmor", l: "Mage Armor +4", sub: "armor · 1 ч/CL" },
                  { k: "shield", l: "Shield +4", sub: "shield · 1 мин/CL" },
                ].map(b => (
                  <button key={b.k} onClick={() => toggleBuff(b.k)} style={{
                    flex: 1, minWidth: 130, padding: "6px 8px", cursor: "pointer", borderRadius: 2,
                    border: `1px solid ${c.buffs?.[b.k] ? T.rust : T.borderLight}`,
                    background: c.buffs?.[b.k] ? T.rust : T.bgCard,
                    color: c.buffs?.[b.k] ? "#fff" : T.muted,
                    fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1, fontWeight: 700,
                  }}>
                    {c.buffs?.[b.k] ? "● " : "○ "}{b.l}
                    <div style={{ fontFamily: fontSerif, fontSize: 10, fontStyle: "italic", letterSpacing: 0, fontWeight: 400 }}>{b.sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 6 }}>
                Базовая 14 · с mage armor 18 · с mage armor + shield 22
              </div>
            </div>

            <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, borderRadius: 3 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                SHIFT (SU) — SWIFT ACTION, 10 FT
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconBtn onClick={() => update("shiftUsed", Math.min(derived.shiftPerDay, (c.shiftUsed || 0) + 1))} title="Использовать">−</IconBtn>
                <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 700, color: shiftLeft > 0 ? T.rust : "#a33" }}>
                  {shiftLeft} / {derived.shiftPerDay}
                </div>
                <IconBtn onClick={() => update("shiftUsed", Math.max(0, (c.shiftUsed || 0) - 1))} title="Вернуть заряд" color={T.forest}>+</IconBtn>
                <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>осталось на день (3 + Int)</span>
              </div>
              <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 6 }}>
                Не провоцирует AoO · не теряешь Dex к КД · нужно видеть точку прибытия · освобождает из угрожаемых зон
              </div>
            </div>
          </div>

          {/* Saves */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Стойкость (Fort)", base: c.fortBase, abil: "Con", amod: abMods.con, total: derived.fort, note: "" },
              { label: "Реакция (Ref)", base: c.refBase, abil: "Dex", amod: abMods.dex, total: derived.ref, note: "" },
              { label: "Воля (Will)", base: c.willBase, abil: "Wis", amod: abMods.wis, total: derived.will, note: `+2 vs Enchantment → ${sign(derived.will + 2)}` },
            ].map(s => (
              <div key={s.label} style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, borderRadius: 3 }}>
                <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>База <strong>{sign(s.base)}</strong></span>
                  <span>{s.abil} <strong>{sign(s.amod)}</strong></span>
                  <span>Cloak <strong>{sign(c.saveResist)}</strong></span>
                  <span style={{ color: T.rust, fontWeight: 700, fontSize: 16 }}>{sign(s.total)}</span>
                </div>
                {s.note && <div style={{ fontSize: 10, color: T.forest, fontStyle: "italic", marginTop: 2 }}>{s.note}</div>}
              </div>
            ))}
          </div>

          {/* Attacks */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Рапира (melee)", val: derived.mab, sub: "1d6 · 18–20/×2 · BAB + Str" },
              { label: "Лёгкий арбалет", val: derived.rab, sub: "1d8 · 19–20/×2 · 80 ft · BAB + Dex" },
              { label: "Ranged touch (лучи, Acid Splash)", val: derived.rab, sub: "BAB + Dex" },
            ].map(s => (
              <div key={s.label} style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, borderRadius: 3 }}>
                <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: T.rust, fontWeight: 700, fontSize: 18 }}>{sign(s.val)}</span>
                  <span style={{ color: T.muted, fontStyle: "italic", marginLeft: 8, fontSize: 11 }}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Tunables */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            <div><Lbl>BAB</Lbl><ParchInput type="number" value={c.bab} onChange={(v) => update("bab", v)} align="center" /></div>
            <div><Lbl>Natural Armor</Lbl><ParchInput type="number" value={c.naturalArmor} onChange={(v) => update("naturalArmor", v)} align="center" /></div>
            <div><Lbl>Deflection</Lbl><ParchInput type="number" value={c.deflection} onChange={(v) => update("deflection", v)} align="center" /></div>
            <div><Lbl>Прочее к КД</Lbl><ParchInput type="number" value={c.acMisc} onChange={(v) => update("acMisc", v)} align="center" /></div>
            <div><Lbl>Cloak (сейвы)</Lbl><ParchInput type="number" value={c.saveResist} onChange={(v) => update("saveResist", v)} align="center" /></div>
            <div><Lbl>Инициатива: прочее</Lbl><ParchInput type="number" value={c.initMisc} onChange={(v) => update("initMisc", v)} align="center" /></div>
          </div>
        </SectionBox>

        {/* TABS */}
        <div style={{ display: "flex", gap: 2, marginBottom: -1, flexWrap: "wrap" }}>
          {[
            { id: "skills", label: "Навыки" },
            { id: "spells", label: "Заклинания · Книга" },
            { id: "feats", label: "Фиты · Черты · Особенности" },
            { id: "gear", label: "Снаряжение · Расходники" },
            { id: "familiar", label: "Фамильяр" },
            { id: "tactics", label: "Тактика · Level-up" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "8px 14px",
              background: activeTab === t.id ? T.bgCard : T.bgParch,
              border: `1.5px solid ${T.border}`,
              borderBottom: activeTab === t.id ? `1.5px solid ${T.bgCard}` : `1.5px solid ${T.border}`,
              fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1.5,
              textTransform: "uppercase", fontWeight: 700,
              color: activeTab === t.id ? T.rustDeep : T.muted,
              cursor: "pointer", borderRadius: "4px 4px 0 0",
            }}>{t.label}</button>
          ))}
        </div>

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 12, borderRadius: "0 4px 4px 4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, padding: 10, background: T.bgParch, border: `1px solid ${T.borderLight}`, borderRadius: 3 }}>
              {[
                { title: "ADVENTURING SKILLS", used: pools.advUsed, avail: pools.advAvail },
                { title: "BACKGROUND SKILLS", used: pools.bgUsed, avail: pools.bgAvail },
              ].map(p => {
                const rem = p.avail - p.used;
                return (
                  <div key={p.title}>
                    <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 2 }}>{p.title}</div>
                    <div style={{ fontSize: 13 }}>
                      Использовано <strong>{p.used}</strong> из <strong>{p.avail}</strong> · осталось
                      <strong style={{ color: rem > 0 ? T.forest : (rem < 0 ? "#b00" : T.ink), marginLeft: 4 }}>{rem}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <table className="sheet-table" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: `linear-gradient(to bottom, ${T.rust}, ${T.rustDeep})`, color: T.bgParch, fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.2 }}>
                  <th style={{ padding: 5, textAlign: "left" }}>Навык</th>
                  <th style={{ padding: 5, width: 60 }}>Abil</th>
                  <th style={{ padding: 5, width: 40 }}>CS</th>
                  <th style={{ padding: 5, width: 32 }}>BG</th>
                  <th style={{ padding: 5, width: 110 }}>Ранги</th>
                  <th style={{ padding: 5, width: 30 }}>Мод</th>
                  <th style={{ padding: 5, width: 50 }}>Итого</th>
                  <th style={{ padding: 5, textAlign: "left" }}>Примечание</th>
                  <th style={{ padding: 5, width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {c.skills.map((s, i) => {
                  const total = skillTotal(s);
                  const hasRanks = s.ranks > 0;
                  return (
                    <tr key={s.id} style={{
                      background: s.bg ? T.bgDeep : (i % 2 === 0 ? T.bgCard : T.bgParch),
                      borderBottom: `1px solid ${T.borderLight}`,
                    }}>
                      <td style={{ padding: "4px 6px", fontWeight: hasRanks ? 700 : 400, color: hasRanks ? T.ink : T.muted }}>
                        {s.name}{s.free && <span style={{ color: T.gold, marginLeft: 4 }} title="Ранги от Headband — вне пулов">✦</span>}
                      </td>
                      <td style={{ padding: 2, textAlign: "center" }}>
                        <select value={s.abil}
                          onChange={(e) => updateSkillField(s.id, "abil", e.target.value)}
                          title="Характеристика — можно менять (Student of Philosophy: Bluff и Diplomacy от Int)"
                          style={{
                            background: T.bgCard, border: `1px solid ${T.borderLight}`,
                            borderRadius: 2, padding: "2px 3px", fontFamily: fontDisplay,
                            fontSize: 10, color: T.rustDeep, fontWeight: 700,
                            letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer",
                          }}>
                          {["str", "dex", "con", "int", "wis", "cha"].map(a => (
                            <option key={a} value={a}>{a.toUpperCase()}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 4, textAlign: "center" }}>
                        <button onClick={() => toggleSkillCS(s.id)} title="Class Skill"
                          style={{
                            padding: "2px 6px", fontSize: 11, fontFamily: fontDisplay, fontWeight: 700,
                            border: `1px solid ${s.cs ? T.rust : T.borderLight}`,
                            background: s.cs ? T.rust : "transparent",
                            color: s.cs ? "#fff" : T.muted, cursor: "pointer", borderRadius: 2,
                          }}>
                          {s.cs ? "●" : "○"}
                        </button>
                      </td>
                      <td style={{ padding: 4, textAlign: "center" }}>
                        {s.bg
                          ? <span style={{ color: T.forest, fontWeight: 700 }}>▲</span>
                          : <span style={{ color: T.muted }}>△</span>}
                      </td>
                      <td style={{ padding: 2, textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <IconBtn onClick={() => bumpSkill(s.id, -1)} title="−1 ранг">−</IconBtn>
                          <input type="number" min="0" max={c.level} value={s.ranks}
                            onChange={(e) => setSkillRanks(s.id, e.target.value)}
                            style={{
                              width: 40, padding: "2px 4px",
                              background: hasRanks ? "#fff8e7" : T.bgCard,
                              border: `1px solid ${T.borderLight}`, borderRadius: 2,
                              fontFamily: "inherit", textAlign: "center", fontWeight: 700,
                            }} />
                          <IconBtn onClick={() => bumpSkill(s.id, +1)} title="+1 ранг">+</IconBtn>
                        </div>
                      </td>
                      <td style={{ padding: 4, textAlign: "center", color: T.muted }}>{sign(abMods[s.abil])}</td>
                      <td style={{ padding: 4, textAlign: "center", fontWeight: 700, fontSize: 14, color: total > 0 ? T.rust : T.ink, fontFamily: fontDisplay }}>
                        {sign(total)}
                      </td>
                      <td style={{ padding: "4px 6px", fontSize: 11, color: T.muted, fontStyle: "italic" }}>
                        {s.note || ""}
                      </td>
                      <td style={{ padding: 2, textAlign: "center" }}>
                        <IconBtn onClick={() => removeSkill(s.id)} title="Удалить" color="#a33">×</IconBtn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 12, padding: 10, background: T.bgParch, border: `1px dashed ${T.borderLight}`, borderRadius: 3 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                + ДОБАВИТЬ СВОЙ НАВЫК (Knowledge, Craft, Lore, Profession…)
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="название, напр. Lore (Azlant)"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomSkill(); }}
                  style={{
                    flex: 2, minWidth: 200, padding: "4px 6px",
                    background: T.bgCard, border: `1px solid ${T.borderLight}`,
                    borderRadius: 2, fontFamily: fontSerif, fontSize: 14,
                  }} />
                <select value={newSkill.abil}
                  onChange={(e) => setNewSkill({ ...newSkill, abil: e.target.value })}
                  style={{ padding: "4px 6px", background: T.bgCard, border: `1px solid ${T.borderLight}`, fontFamily: fontSerif, fontSize: 13 }}>
                  {["str", "dex", "con", "int", "wis", "cha"].map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={newSkill.cs} onChange={(e) => setNewSkill({ ...newSkill, cs: e.target.checked })} />
                  Class Skill
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={newSkill.bg} onChange={(e) => setNewSkill({ ...newSkill, bg: e.target.checked })} />
                  Background
                </label>
                <button onClick={addCustomSkill} style={{
                  padding: "5px 14px", background: T.forest, color: "#fff", border: "none",
                  borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1,
                }}>ДОБАВИТЬ</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: T.muted, fontStyle: "italic" }}>
              <span style={{ color: T.rust }}>●</span> Class Skill — клик по кружку переключает · при ≥ 1 ранге +3 к итогу
              <span style={{ color: T.forest, marginLeft: 12 }}>▲</span> Background Skill (отдельный пул)
              <span style={{ color: T.gold, marginLeft: 12 }}>✦</span> Ранги от Headband — не тратят пулы
            </div>
          </div>
        )}

        {/* SPELLS TAB */}
        {activeTab === "spells" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 14, borderRadius: "0 4px 4px 4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
              <Stat label="Caster Level" value={derived.casterLevel} sub={`${derived.clVsSR} vs SR — Elven Magic`} />
              <Stat label="Concentration" value={sign(derived.concentration)} sub="CL + Int" />
              <Stat label="DC базовый" value={`${derived.dc(0)} + круг`} sub="10 + круг + Int" />
              <Stat label="DC Conjuration" value={`${derived.dcConj(0)} + круг`} sub="+2 Spell Focus / Greater" accent />
              <Stat label="Summoner's Charm" value={`+${derived.charmRounds} р.`} sub="длительность summoning" />
            </div>

            <div style={{ padding: "10px 12px", background: T.bgParch, border: `1px solid ${T.borderLight}`, marginBottom: 14, fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
              <div>
                <strong>Специализация:</strong> {c.specialistSchool} ({c.subschool})<br />
                <strong>Запрещённые школы:</strong> {c.oppositionSchools}<br />
                <span style={{ color: T.muted, fontStyle: "italic" }}>запретная школа — двойной слот на заклинание</span>
              </div>
              <div>
                <strong>Слоты в день (Wizard {c.level}):</strong>
                <table className="sheet-table" style={{ marginTop: 4, fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: T.rustDeep, fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1 }}>
                      <th style={{ textAlign: "left", padding: 2 }}>Круг</th>
                      <th style={{ padding: 2 }}>База</th>
                      <th style={{ padding: 2 }}>Int</th>
                      <th style={{ padding: 2 }}>Школа</th>
                      <th style={{ padding: 2 }}>Итого</th>
                      <th style={{ padding: 2 }}>Ручной ввод</th>
                      <th style={{ padding: 2 }}>DC / Conj</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: 2 }}>Кантрипы</td>
                      <td style={{ padding: 2, textAlign: "center" }}>{derived.cantripsPerDay}</td>
                      <td style={{ padding: 2, textAlign: "center" }}>—</td>
                      <td style={{ padding: 2, textAlign: "center" }}>—</td>
                      <td style={{ padding: 2, textAlign: "center", fontWeight: 700 }}>{derived.cantripsPerDay}</td>
                      <td style={{ padding: 2, textAlign: "center", color: T.muted }}>∞ кастов</td>
                      <td style={{ padding: 2, textAlign: "center" }}>{derived.dc(0)} / <strong>{derived.dcConj(0)}</strong></td>
                    </tr>
                    {[1, 2, 3, 4, 5].map(circle => {
                      const s = slots[circle];
                      if (!s) return null;
                      return (
                        <tr key={circle} style={{ borderTop: `1px solid ${T.borderLight}` }}>
                          <td style={{ padding: 2 }}>{circle}-й</td>
                          <td style={{ padding: 2, textAlign: "center" }}>{s.base}</td>
                          <td style={{ padding: 2, textAlign: "center" }}>+{s.int}</td>
                          <td style={{ padding: 2, textAlign: "center" }}>+{s.school}</td>
                          <td style={{ padding: 2, textAlign: "center", fontWeight: 700, color: T.rust, fontSize: 14 }}>{s.total}</td>
                          <td style={{ padding: 2, textAlign: "center" }}>
                            <input type="number" min="0" value={s.override || ""}
                              placeholder="авто"
                              onChange={(e) => setOverride(circle, e.target.value)}
                              style={{ width: 46, padding: "1px 3px", background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 2, textAlign: "center", fontFamily: fontSerif, fontSize: 12 }} />
                          </td>
                          <td style={{ padding: 2, textAlign: "center" }}>{derived.dc(circle)} / <strong>{derived.dcConj(circle)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 4 }}>
                  ⚠ В статблоке 1-й круг = 5 (3 база + 1 Int + 1 школа). По таблице бонусных заклинаний Int 20–21 даёт <strong>+2</strong> к 1-му кругу → 6.
                  Если мастер считает иначе — впиши 5 в «ручной ввод».
                </div>
              </div>
            </div>

            <SpellTier
              title="КАНТРИПЫ (книга — все 19 из PHB)"
              stats={`подготовлено ${prepStats.cantripsP} / ${derived.cantripsPerDay}`}
              dcLine={`DC ${derived.dc(0)} · Conjuration DC ${derived.dcConj(0)}`}
              spells={c.spellbook.cantrips}
              isLeveled={false}
              specialistSchool={c.specialistSchool}
              oppositionSchools={c.oppositionSchools}
              onUpdate={(id, patch) => updateSpell("cantrips", id, patch)}
              onRemove={(id) => removeSpell("cantrips", id)}
              newSpell={newSpell.cantrips}
              setNewSpell={(s) => setNewSpell({ ...newSpell, cantrips: s })}
              onAdd={() => addSpell("cantrips")}
            />

            <SpellTier
              title="1-й КРУГ (книга)"
              stats={`подготовлено ${prepStats.l1P} / ${slots[1]?.total ?? 0}`}
              dcLine={`DC ${derived.dc(1)} · Conjuration DC ${derived.dcConj(1)}`}
              spells={c.spellbook.level1}
              isLeveled={true}
              specialistSchool={c.specialistSchool}
              oppositionSchools={c.oppositionSchools}
              onUpdate={(id, patch) => updateSpell("level1", id, patch)}
              onRemove={(id) => removeSpell("level1", id)}
              newSpell={newSpell.level1}
              setNewSpell={(s) => setNewSpell({ ...newSpell, level1: s })}
              onAdd={() => addSpell("level1")}
            />

            <SpellTier
              title="2-й КРУГ (книга)"
              stats={`подготовлено ${prepStats.l2P} / ${slots[2]?.total ?? 0}`}
              dcLine={`DC ${derived.dc(2)} · Conjuration DC ${derived.dcConj(2)}`}
              spells={c.spellbook.level2}
              isLeveled={true}
              specialistSchool={c.specialistSchool}
              oppositionSchools={c.oppositionSchools}
              onUpdate={(id, patch) => updateSpell("level2", id, patch)}
              onRemove={(id) => removeSpell("level2", id)}
              newSpell={newSpell.level2}
              setNewSpell={(s) => setNewSpell({ ...newSpell, level2: s })}
              onAdd={() => addSpell("level2")}
            />

            <SpellTier
              title="★ 3-й КРУГ (новый на 5-м уровне)"
              stats={`подготовлено ${prepStats.l3P} / ${slots[3]?.total ?? 0}`}
              dcLine={`DC ${derived.dc(3)} · Conjuration DC ${derived.dcConj(3)} — stinking cloud идёт по ${derived.dcConj(3)}`}
              spells={c.spellbook.level3}
              isLeveled={true}
              specialistSchool={c.specialistSchool}
              oppositionSchools={c.oppositionSchools}
              onUpdate={(id, patch) => updateSpell("level3", id, patch)}
              onRemove={(id) => removeSpell("level3", id)}
              newSpell={newSpell.level3}
              setNewSpell={(s) => setNewSpell({ ...newSpell, level3: s })}
              onAdd={() => addSpell("level3")}
            />

            <div style={{ padding: 10, background: T.bgParch, border: `1px solid ${T.borderLight}`, fontSize: 12 }}>
              <strong>Summon-арсенал через свитки:</strong> 2× свиток <em>summon monster III</em> (CL 5) — быстрый вызов Small elemental / Lemure / 1d3 существ SM II без траты слота 3-го круга.
              Summoner's Charm добавляет им +{derived.charmRounds} раунда длительности.
            </div>
          </div>
        )}

        {/* FEATS TAB */}
        {activeTab === "feats" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 14, borderRadius: "0 4px 4px 4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <EditableList title="ФИТЫ" color={T.rust} items={c.feats}
                fields={[
                  { key: "name", placeholder: "Название фита", bold: true },
                  { key: "source", placeholder: "Источник / эффект", textarea: true, italic: true, small: true },
                ]}
                onAdd={() => addItem("feats", { name: "Новый фит", source: "" })}
                onUpdate={(id, patch) => updateItem("feats", id, patch)}
                onRemove={(id) => removeItem("feats", id)}
              />
              <EditableList title="ЧЕРТЫ (Traits)" color={T.forest} items={c.traits}
                fields={[
                  { key: "name", placeholder: "Название черты", bold: true },
                  { key: "desc", placeholder: "Описание", textarea: true },
                ]}
                onAdd={() => addItem("traits", { name: "Новая черта", desc: "" })}
                onUpdate={(id, patch) => updateItem("traits", id, patch)}
                onRemove={(id) => removeItem("traits", id)}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <EditableList title="ОСОБЫЕ СПОСОБНОСТИ · РАСА · ШКОЛА · ПРЕДМЕТЫ" color={T.gold} items={c.features}
                fields={[
                  { key: "name", placeholder: "Название", bold: true },
                  { key: "desc", placeholder: "Описание", textarea: true },
                ]}
                onAdd={() => addItem("features", { name: "Новая способность", desc: "" })}
                onUpdate={(id, patch) => updateItem("features", id, patch)}
                onRemove={(id) => removeItem("features", id)}
              />
            </div>
          </div>
        )}

        {/* GEAR TAB */}
        {activeTab === "gear" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 14, borderRadius: "0 4px 4px 4px" }}>

            {/* Мастерская */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700 }}>
                  ✦ МАСТЕРСКАЯ — CRAFT WAND + SCRIBE SCROLL (всё за 50% цены)
                </div>
                <button onClick={() => addItem("craftQueue", { name: "Новый предмет", cost: "", days: "", status: "plan", note: "" })} style={{
                  padding: "3px 10px", background: T.forest, color: "#fff", border: "none",
                  borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
                }}>+ В ОЧЕРЕДЬ</button>
              </div>

              <table className="sheet-table" style={{ fontSize: 12, marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(to bottom, ${T.rust}, ${T.rustDeep})`, color: T.bgParch, fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.2 }}>
                    <th style={{ padding: 5, width: 90 }}>Статус</th>
                    <th style={{ padding: 5, textAlign: "left" }}>Предмет</th>
                    <th style={{ padding: 5, width: 80 }}>Крафт, gp</th>
                    <th style={{ padding: 5, width: 60 }}>Дней</th>
                    <th style={{ padding: 5, textAlign: "left" }}>Примечание</th>
                    <th style={{ padding: 5, width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {c.craftQueue.map((it, i) => {
                    const st = {
                      plan: { l: "план", bg: T.bgCard, col: T.muted, br: T.borderLight },
                      wip: { l: "в работе", bg: T.conj, col: T.rustDeep, br: T.rust },
                      done: { l: "✓ готово", bg: "#e3ecdd", col: T.forest, br: T.forest },
                    }[it.status] || { l: "план", bg: T.bgCard, col: T.muted, br: T.borderLight };
                    return (
                      <tr key={it.id} style={{
                        background: it.status === "done" ? "#eef3ea" : (i % 2 === 0 ? T.bgCard : T.bgParch),
                        borderBottom: `1px solid ${T.borderLight}`,
                        opacity: it.status === "done" ? 0.7 : 1,
                      }}>
                        <td style={{ padding: 4, textAlign: "center" }}>
                          <button onClick={() => cycleCraft(it.id)} title="план → в работе → готово"
                            style={{
                              width: "100%", padding: "3px 4px", cursor: "pointer", borderRadius: 2,
                              border: `1px solid ${st.br}`, background: st.bg, color: st.col,
                              fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1, fontWeight: 700,
                            }}>{st.l}</button>
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input value={it.name} onChange={(e) => updateItem("craftQueue", it.id, { name: e.target.value })}
                            style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 13, fontWeight: 700, color: T.ink, padding: 0, textDecoration: it.status === "done" ? "line-through" : "none" }} />
                        </td>
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          <input value={it.cost} onChange={(e) => updateItem("craftQueue", it.id, { cost: e.target.value })}
                            style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontDisplay, fontSize: 13, fontWeight: 700, color: T.rust, padding: 0, textAlign: "center" }} />
                        </td>
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          <input value={it.days} onChange={(e) => updateItem("craftQueue", it.id, { days: e.target.value })}
                            style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 13, color: T.muted, padding: 0, textAlign: "center" }} />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input value={it.note} onChange={(e) => updateItem("craftQueue", it.id, { note: e.target.value })}
                            style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 11, fontStyle: "italic", color: T.muted, padding: 0 }} />
                        </td>
                        <td style={{ padding: 2, textAlign: "center" }}>
                          <IconBtn onClick={() => removeItem("craftQueue", it.id)} title="Удалить" color="#a33">×</IconBtn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ background: T.bgParch, border: `1px dashed ${T.borderLight}`, padding: 10 }}>
                <div style={{ fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                  ПРАВИЛА КРАФТА — ШПАРГАЛКА
                </div>
                <table className="sheet-table" style={{ fontSize: 11 }}>
                  <tbody>
                    {CRAFT_REF.map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: `1px dotted ${T.borderLight}` }}>
                        <td style={{ padding: "3px 6px", width: 170, fontWeight: 700, verticalAlign: "top", color: k.startsWith("⚠") ? "#a33" : T.ink }}>{k}</td>
                        <td style={{ padding: "3px 6px", color: T.muted, fontStyle: "italic" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consumables */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700 }}>
                  ПАЛОЧКИ · СВИТКИ · РАСХОДНИКИ
                </div>
                <button onClick={refillCons} style={{
                  padding: "3px 10px", background: T.forest, color: "#fff", border: "none",
                  borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
                }}>ВОССТАНОВИТЬ ВСЁ</button>
              </div>
              <table className="sheet-table" style={{ fontSize: 12 }}>
                <tbody>
                  {c.consumables.map((it, i) => (
                    <tr key={it.id} style={{ background: i % 2 === 0 ? T.bgCard : T.bgParch, borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: "6px 8px", width: 240 }}>
                        <input value={it.name} placeholder="название расходника"
                          onChange={(e) => updateItem("consumables", it.id, { name: e.target.value })}
                          style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 13, fontWeight: 700, color: T.ink, padding: 0 }} />
                      </td>
                      <td style={{ padding: "6px 8px", width: 170, textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconBtn onClick={() => bumpCons(it.id, -1)} title="Потратить">−</IconBtn>
                          <input type="number" value={it.cur}
                            onChange={(e) => updateItem("consumables", it.id, { cur: Number(e.target.value) || 0 })}
                            title="Текущий заряд"
                            style={{ width: 42, textAlign: "center", fontFamily: fontDisplay, fontWeight: 700, fontSize: 14, color: Number(it.cur) === 0 ? "#a33" : T.rust, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 2, padding: "2px 0" }} />
                          <span style={{ color: T.muted }}>/</span>
                          <input type="number" value={it.max}
                            onChange={(e) => updateItem("consumables", it.id, { max: Number(e.target.value) || 0 })}
                            title="Максимум зарядов"
                            style={{ width: 42, textAlign: "center", fontFamily: fontDisplay, fontWeight: 700, fontSize: 14, color: T.muted, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 2, padding: "2px 0" }} />
                          <IconBtn onClick={() => bumpCons(it.id, +1)} title="Вернуть" color={T.forest}>+</IconBtn>
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input value={it.note} placeholder="примечание"
                          onChange={(e) => updateItem("consumables", it.id, { note: e.target.value })}
                          style={{ width: "100%", background: "transparent", border: "none", fontFamily: fontSerif, fontSize: 11, fontStyle: "italic", color: T.muted, padding: 0 }} />
                      </td>
                      <td style={{ padding: 2, width: 28, textAlign: "center" }}>
                        <IconBtn onClick={() => removeItem("consumables", it.id)} title="Удалить" color="#a33">×</IconBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => addItem("consumables", { name: "Новый расходник", cur: 1, max: 1, note: "" })} style={{
                marginTop: 6, padding: "3px 10px", background: T.forest, color: "#fff", border: "none",
                borderRadius: 2, cursor: "pointer", fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1,
              }}>+ ДОБАВИТЬ РАСХОДНИК</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
              <EditableList title="СНАРЯЖЕНИЕ (где лежит · цена)" color={T.rust} items={c.equipment}
                fields={[
                  { key: "name", placeholder: "Предмет", bold: true },
                  { key: "loc", placeholder: "Где лежит", small: true },
                  { key: "cost", placeholder: "Цена, gp", small: true },
                  { key: "notes", placeholder: "Примечание", italic: true, small: true },
                ]}
                onAdd={() => addItem("equipment", { name: "Новый предмет", loc: "", cost: "", notes: "" })}
                onUpdate={(id, patch) => updateItem("equipment", id, patch)}
                onRemove={(id) => removeItem("equipment", id)}
              />

              <div>
                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                  ЯЗЫКИ
                </div>
                <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 10, marginBottom: 14 }}>
                  {c.languages.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: i < c.languages.length - 1 ? `1px dotted ${T.borderLight}` : "none" }}>
                      <span style={{ fontSize: 13 }}>◆ {l}</span>
                      <IconBtn onClick={() => removeLang(i)} title="Удалить" color="#a33">×</IconBtn>
                    </div>
                  ))}
                  <AddLang onAdd={addLang} />
                </div>

                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                  БЮДЖЕТ
                </div>
                <table className="sheet-table" style={{ fontSize: 11, marginBottom: 8 }}>
                  <tbody>
                    {BUDGET.map(([cat, items, cost], i) => (
                      <tr key={cat} style={{ background: i % 2 === 0 ? T.bgCard : T.bgParch, borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: "4px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{cat}</td>
                        <td style={{ padding: "4px 6px", color: T.muted, fontStyle: "italic" }}>{items}</td>
                        <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: fontDisplay, fontWeight: 700, color: T.rust, whiteSpace: "nowrap" }}>{cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, fontSize: 11 }}>
                  {BUDGET_FOOT.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                      <span style={{ color: T.muted }}>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                  <div style={{ marginTop: 6, fontStyle: "italic", color: T.muted, fontSize: 10 }}>
                    Долг перед партией символический — 14 gp на округление.
                  </div>
                </div>

                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, margin: "12px 0 6px" }}>
                  РАЗРЫВ БЮДЖЕТА
                </div>
                <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 8, fontSize: 12 }}>
                  {(() => {
                    const gold = Number(c.gold) || 0;
                    const gap = GOLD_FREE_BEFORE - craftTotal;   // 2 111 − 7 050 = −4 939
                    const rows = [
                      ["Свободно было", `${fmtGp(GOLD_FREE_BEFORE)} gp`, T.ink],
                      ["Крафт очереди (изготовлено)", `−${fmtGp(craftTotal)} gp`, T.rust],
                      [gap < 0 ? "Дефицит — закрыть добычей" : "Остаток после крафта", `${fmtGp(gap)} gp`, gap < 0 ? "#b00" : T.forest],
                    ];
                    return (
                      <>
                        {rows.map(([k, v, col]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `1px dotted ${T.borderLight}` }}>
                            <span style={{ color: T.muted }}>{k}</span>
                            <strong style={{ color: col, fontFamily: fontDisplay }}>{v}</strong>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", alignItems: "baseline" }}>
                          <span style={{ color: T.rustDeep, fontWeight: 700 }}>Золото на руках сейчас</span>
                          <strong style={{ color: gold < 0 ? "#b00" : T.rust, fontFamily: fontDisplay, fontSize: 16 }}>{fmtGp(gold)} gp</strong>
                        </div>
                        <div style={{ marginTop: 6, fontStyle: "italic", color: T.muted, fontSize: 10 }}>
                          Дефицит ≈ {fmtGp(Math.abs(gap))} gp закрывается добычей из первой части кампании. Правь золото в шапке.
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Next buys */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                СЛЕДУЮЩИЕ ПОКУПКИ (когда появится золото)
              </div>
              <table className="sheet-table" style={{ fontSize: 12 }}>
                <tbody>
                  {NEXT_BUYS.map(([n, item, price, why], i) => (
                    <tr key={n} style={{ background: i % 2 === 0 ? T.bgCard : T.bgParch, borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: "5px 8px", width: 24, fontFamily: fontDisplay, color: T.gold, fontWeight: 700 }}>{n}</td>
                      <td style={{ padding: "5px 8px", fontWeight: 700, width: 260 }}>{item}</td>
                      <td style={{ padding: "5px 8px", width: 90, fontFamily: fontDisplay, color: T.rust }}>{price}</td>
                      <td style={{ padding: "5px 8px", color: T.muted, fontStyle: "italic" }}>{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAMILIAR TAB */}
        {activeTab === "familiar" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 14, borderRadius: "0 4px 4px 4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                  {FAMILIAR.title}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", marginBottom: 8 }}>{FAMILIAR.intro}</div>

                <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, padding: 10, marginBottom: 10 }}>
                  <Lbl>HP фамильяра (½ от макс. HP мастера)</Lbl>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <IconBtn onClick={() => update("famHpCurrent", Math.max(0, (c.famHpCurrent || 0) - 1))} title="−1 HP">−</IconBtn>
                    <span style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 700, color: (c.famHpCurrent || 0) > famHpMax / 2 ? T.rust : "#a33" }}>
                      {c.famHpCurrent} / {famHpMax}
                    </span>
                    <IconBtn onClick={() => update("famHpCurrent", Math.min(famHpMax, (c.famHpCurrent || 0) + 1))} title="+1 HP" color={T.forest}>+</IconBtn>
                  </div>
                </div>

                <table className="sheet-table" style={{ fontSize: 12 }}>
                  <tbody>
                    {FAMILIAR.stats.map(([k, v], i) => (
                      <tr key={k} style={{ background: i % 2 === 0 ? T.bgCard : T.bgParch, borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: "5px 8px", width: 90, fontFamily: fontDisplay, fontSize: 10, letterSpacing: 1, color: T.rustDeep, fontWeight: 700, textTransform: "uppercase" }}>{k}</td>
                        <td style={{ padding: "5px 8px" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                  ЧТО ПОЛУЧАЕТ МАСТЕР
                </div>
                <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, borderLeft: `3px solid ${T.forest}`, padding: 10, marginBottom: 12 }}>
                  {FAMILIAR.master.map(m => (
                    <div key={m} style={{ fontSize: 13, padding: "3px 0", borderBottom: `1px dotted ${T.borderLight}` }}>◆ {m}</div>
                  ))}
                </div>
                <div style={{ background: "#f7e3dd", border: `1px solid #c9776a`, borderLeft: "3px solid #a33", padding: 10, fontSize: 12, color: T.ink }}>
                  <strong style={{ fontFamily: fontDisplay, letterSpacing: 1, fontSize: 11 }}>ЕСЛИ ФАМИЛЬЯР ПОГИБНЕТ</strong>
                  <div style={{ marginTop: 4, fontStyle: "italic" }}>{FAMILIAR.death}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TACTICS TAB */}
        {activeTab === "tactics" && (
          <div style={{ background: T.bgCard, border: `1.5px solid ${T.border}`, padding: 14, borderRadius: "0 4px 4px 4px" }}>
            <div style={{
              padding: "8px 12px", background: T.conj, border: `1px solid ${T.rust}`,
              marginBottom: 12, fontSize: 13, fontStyle: "italic",
            }}>
              <strong>Инициатива {sign(derived.init)} — почти всегда ходишь первым.</strong> Эксплуатируй это агрессивно.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {TACTICS.map(block => (
                <div key={block.title} style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, borderLeft: `3px solid ${T.rust}`, padding: 10 }}>
                  <div style={{ fontFamily: fontDisplay, fontSize: 11, letterSpacing: 1.2, color: T.rustDeep, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>
                    {block.title}
                  </div>
                  {block.lines.map(l => (
                    <div key={l} style={{ fontSize: 12, padding: "2px 0", borderBottom: `1px dotted ${T.borderLight}` }}>◆ {l}</div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: fontDisplay, fontSize: 12, letterSpacing: 1.5, color: T.rustDeep, fontWeight: 700, marginBottom: 6 }}>
                ЧТО ИЗМЕНИЛОСЬ С 3-го УРОВНЯ
              </div>
              <div style={{ background: T.bgParch, border: `1px solid ${T.borderLight}`, borderLeft: `3px solid ${T.forest}`, padding: 10 }}>
                {LEVELUP.map(l => (
                  <div key={l} style={{ fontSize: 12, padding: "3px 0", borderBottom: `1px dotted ${T.borderLight}` }}>
                    <span style={{ color: T.forest, fontWeight: 700, marginRight: 6 }}>✓</span>{l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 10, textAlign: "center", fontSize: 10, color: T.muted, fontFamily: fontDisplay, letterSpacing: 2 }}>
          ✦ PATHFINDER 1E · SHATTERED STAR · ЭЙЛИНДАР ВЭЙН · УРОВЕНЬ 5 ✦
        </div>
      </div>
    </div>
  );
}

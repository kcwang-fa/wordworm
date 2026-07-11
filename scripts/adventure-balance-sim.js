#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RUNS = Number(process.argv.find(arg => arg.startsWith('--runs='))?.split('=')[1]) || 4000;
const LETTER_SCORE_MEAN = 1.87;

const context = {};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js/adventure-data.js'), 'utf8') +
    '\nthis.ADVENTURE_LEVELS = ADVENTURE_LEVELS;',
  context
);

const levels = context.ADVENTURE_LEVELS;
const profiles = {
  cautious: [[3, .22], [4, .36], [5, .27], [6, .12], [7, .03]],
  normal: [[3, .10], [4, .28], [5, .34], [6, .20], [7, .07], [8, .01]],
  strong: [[4, .14], [5, .30], [6, .29], [7, .19], [8, .08]],
};

function heroExpToNext(heroLevel) {
  return 60 + Math.max(0, heroLevel - 1) * 25;
}

function heroMaxHp(heroLevel) {
  return 100 + Math.max(0, heroLevel - 1) * 6;
}

function heroAttackBonus(heroLevel) {
  return Math.floor(Math.max(0, heroLevel - 1) / 3);
}

function adventureExpReward(level) {
  return 20 + Math.round(level.globalIdx * 2.5);
}

function grantHeroExp(player, amount) {
  const oldLevel = player.level;
  player.exp += amount;
  while (player.level < 30 && player.exp >= heroExpToNext(player.level)) {
    player.exp -= heroExpToNext(player.level);
    player.level++;
  }
  if (player.level > oldLevel) player.hp = heroMaxHp(player.level);
}

function grantReward(items, level) {
  if (level.boss) {
    items.heal = Math.min(9, items.heal + 1);
    items.cleanse = Math.min(9, items.cleanse + 1);
    items.strike = Math.min(9, items.strike + 1);
    return;
  }
  const id = ['heal', 'cleanse', 'strike'][level.globalIdx % 3];
  items[id] = Math.min(9, items[id] + 1);
}

function pickLength(profile) {
  const x = Math.random();
  let acc = 0;
  for (const [length, probability] of profile) {
    acc += probability;
    if (x <= acc) return length;
  }
  return profile[profile.length - 1][0];
}

function turnDamage(length, heroBonus, cursedRate) {
  const letterNoise = .78 + Math.random() * .48;
  let damage = length * 3 + Math.round(length * LETTER_SCORE_MEAN * letterNoise) + heroBonus;
  if (length >= 8) damage += 20;
  else if (length >= 7) damage += 12;
  else if (length >= 6) damage += 8;
  else if (length >= 5) damage += 4;
  if (Math.random() < cursedRate) damage = Math.round(damage * .5);
  return Math.max(1, damage);
}

function simulate(profile) {
  const rows = levels.map(level => ({
    map: level.mapLabel,
    id: level.id,
    hp: level.hp,
    atk: level.atk,
    n: 0,
    wins: 0,
    turns: 0,
    hpLeft: 0,
    heroLevel: 0,
    damage: 0,
    heals: 0,
    strikes: 0,
  }));
  let campaignClears = 0;

  for (let run = 0; run < RUNS; run++) {
    const player = { level: 1, exp: 0, hp: 100 };
    const items = { heal: 2, cleanse: 1, strike: 1 };
    let clearedCampaign = true;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      let monsterHp = level.hp;
      let turns = 0;
      let damageTotal = 0;
      let healsUsed = 0;
      let strikesUsed = 0;
      let debuffPressure = 0;

      if ((level.boss || level.chapterIdx >= 4) && items.strike > 0 && monsterHp > 70) {
        monsterHp = Math.max(0, monsterHp - 22);
        items.strike--;
        strikesUsed++;
      }

      while (monsterHp > 0 && player.hp > 0 && turns < 80) {
        if (player.hp <= level.atk + 8 && items.heal > 0) {
          player.hp = Math.min(heroMaxHp(player.level), player.hp + 25);
          items.heal--;
          healsUsed++;
        }
        if (debuffPressure >= 4 && items.cleanse > 0) {
          debuffPressure = 0;
          items.cleanse--;
        }

        const length = pickLength(profile);
        const cursedRate = Math.min(.22, debuffPressure * .035);
        const damage = turnDamage(length, heroAttackBonus(player.level), cursedRate);
        monsterHp = Math.max(0, monsterHp - damage);
        damageTotal += damage;
        turns++;
        debuffPressure = Math.max(0, debuffPressure - 1);
        if (monsterHp <= 0) break;

        player.hp = Math.max(0, player.hp - level.atk);
        if (Math.random() < (level.boss ? .25 : .15)) {
          debuffPressure += Math.random() < .5 ? 1 : 2;
        }
      }

      const won = monsterHp <= 0 && player.hp > 0;
      const row = rows[i];
      row.n++;
      row.wins += won ? 1 : 0;
      row.turns += turns;
      row.hpLeft += player.hp;
      row.heroLevel += player.level;
      row.damage += damageTotal / Math.max(1, turns);
      row.heals += healsUsed;
      row.strikes += strikesUsed;

      if (!won) {
        clearedCampaign = false;
        break;
      }

      grantReward(items, level);
      grantHeroExp(player, adventureExpReward(level));
    }

    if (clearedCampaign) campaignClears++;
  }

  return { campaignClears, rows };
}

function fmt(num, digits = 1) {
  return Number.isFinite(num) ? num.toFixed(digits) : 'n/a';
}

console.log(`Adventure balance simulation (${RUNS.toLocaleString()} campaigns per profile)`);
console.log('Assumptions: valid attacks only, HP refills only on level-up, automatic low-HP heal, strike used on bosses and chapters 5-7 when available.');

for (const [name, profile] of Object.entries(profiles)) {
  const result = simulate(profile);
  console.log(`\nProfile: ${name}`);
  console.log(`Campaign clear rate: ${fmt(result.campaignClears / RUNS * 100)}%`);
  console.log('Map  Monster                  HP  Turns  Win%   HP Left  Dmg/Turn  Heal  Strike');
  for (const row of result.rows.filter(item => /^[5-7]-/.test(item.map))) {
    const cells = [
      row.map.padEnd(4),
      row.id.padEnd(24),
      String(row.hp).padStart(3),
      fmt(row.turns / row.n).padStart(5),
      `${fmt(row.wins / row.n * 100)}%`.padStart(6),
      fmt(row.hpLeft / row.n).padStart(7),
      fmt(row.damage / row.n).padStart(8),
      fmt(row.heals / row.n, 2).padStart(5),
      fmt(row.strikes / row.n, 2).padStart(6),
    ];
    console.log(cells.join('  '));
  }
}

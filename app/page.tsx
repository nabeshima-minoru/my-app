'use client';

import { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 8;
const STAR_COUNT = 80;
const FIRE_INTERVAL = 6;
const POWER_UP_THRESHOLD = 100;
const MAX_POWER_LEVEL = 5;

// 敵レベル別パラメータ
const ENEMY_SPAWN_INTERVALS = [60, 55, 50, 45, 40];
const ENEMY_SPAWN_COUNTS = [1, 1, 2, 2, 3]; // 同時出現数
const ENEMY_HPS = [1, 2, 3, 4, 5]; // 耐久力
const ENEMY_SCORES = [10, 20, 30, 40, 50]; // 撃破スコア
const ENEMY_SPEEDS_Y = [2.0, 2.5, 3.0, 3.5, 4.0];
const ENEMY_VX_RANGES = [3, 4, 5, 6, 7];
const ENEMY_COLORS = ['#ef4444', '#f97316', '#a855f7', '#6366f1', '#1f2937'];

// 敵の攻撃パラメータ
const ENEMY_FIRE_INTERVALS = [180, 150, 120, 90, 60];
const ENEMY_BULLET_SPEEDS = [3.0, 3.5, 4.0, 4.5, 5.0];

const PLAYER_HITBOX_MARGIN = 6;

type Entity = { x: number; y: number; w: number; h: number };
type Bullet = Entity & { power: number };
type EnemyBullet = Entity & { vx: number; vy: number };
type Enemy = Entity & {
  vx: number;
  level: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  damageFlash: number; // ダメージ受けた時の点滅用
};
type Star = { x: number; y: number; speed: number; size: number };

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bgmIntervalRef.current) {
        clearInterval(bgmIntervalRef.current);
        bgmIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const startBGM = () => {
    if (audioCtxRef.current || !bgmEnabled) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 392.0, 523.25];
    let step = 0;

    const playNote = () => {
      if (!audioCtxRef.current) return;
      const c = audioCtxRef.current;
      const freq = notes[step % notes.length];
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.2);
      step++;
    };

    bgmIntervalRef.current = window.setInterval(playNote, 200);
  };

  const playShootSound = () => {
    if (!audioCtxRef.current) return;
    const c = audioCtxRef.current;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.05);
    gain.gain.setValueAtTime(0.03, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.05);
  };

  const playExplosionSound = () => {
    if (!audioCtxRef.current) return;
    const c = audioCtxRef.current;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.15);
  };

  // ダメージ音(撃破未満のヒット時)
  const playHitSound = () => {
    if (!audioCtxRef.current) return;
    const c = audioCtxRef.current;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.04);
    gain.gain.setValueAtTime(0.04, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.04);
  };

  const playEnemyShootSound = () => {
    if (!audioCtxRef.current) return;
    const c = audioCtxRef.current;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.025, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.08);
  };

  const playLevelUpSound = () => {
    if (!audioCtxRef.current) return;
    const c = audioCtxRef.current;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = c.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player: Entity = {
      x: CANVAS_WIDTH / 2 - 15,
      y: CANVAS_HEIGHT - 60,
      w: 30,
      h: 30,
    };
    const bullets: Bullet[] = [];
    const enemyBullets: EnemyBullet[] = [];
    const enemies: Enemy[] = [];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: Math.random() * 2 + 0.5,
      size: Math.random() * 2 + 0.5,
    }));
    const keys: Record<string, boolean> = {};
    let frameCount = 0;
    let fireCooldown = 0;
    let localScore = 0;
    let isGameOver = false;
    let animationId = 0;
    let lastLevel = 1;
    let nextEnemySpawnFrame = ENEMY_SPAWN_INTERVALS[0];

    const getLevel = (s: number) =>
      Math.min(Math.floor(s / POWER_UP_THRESHOLD) + 1, MAX_POWER_LEVEL);
    const getBulletSize = (level: number) => ({
      w: 4 + (level - 1) * 4,
      h: 12 + (level - 1) * 2,
    });

    const getPlayerHitbox = (): Entity => ({
      x: player.x + PLAYER_HITBOX_MARGIN,
      y: player.y + PLAYER_HITBOX_MARGIN,
      w: player.w - PLAYER_HITBOX_MARGIN * 2,
      h: player.h - PLAYER_HITBOX_MARGIN * 2,
    });

    // 敵生成のヘルパー(同時出現対応・横位置を分散)
    const spawnEnemies = (count: number, level: number) => {
      const lvIdx = level - 1;
      const range = ENEMY_VX_RANGES[lvIdx];
      const hp = ENEMY_HPS[lvIdx];
      const baseInterval = ENEMY_FIRE_INTERVALS[lvIdx];
      // 横方向を等分してスロットを作る(完全な重なり防止)
      for (let k = 0; k < count; k++) {
        const slotWidth = (CANVAS_WIDTH - 30) / count;
        const x = slotWidth * k + Math.random() * slotWidth;
        enemies.push({
          x,
          y: -30,
          w: 30,
          h: 30,
          vx: (Math.random() - 0.5) * range,
          level,
          hp,
          maxHp: hp,
          // 全敵が確実に1発以上撃つよう、初回クールダウンは間隔の30%〜80%
          fireCooldown: Math.floor(baseInterval * (0.3 + Math.random() * 0.5)),
          damageFlash: 0,
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'z', 'Z', ' '].includes(
          e.key
        )
      ) {
        e.preventDefault();
      }
      keys[e.key] = true;
      startBGM();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const isHit = (a: Entity, b: Entity) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const triggerGameOver = () => {
      isGameOver = true;
      setGameOver(true);
      playExplosionSound();
      if (bgmIntervalRef.current) {
        clearInterval(bgmIntervalRef.current);
        bgmIntervalRef.current = null;
      }
    };

    const loop = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#ffffff';
      stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > CANVAS_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * CANVAS_WIDTH;
        }
        ctx.globalAlpha = s.speed / 2.5;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1;

      const currentLevel = getLevel(localScore);

      if (currentLevel > lastLevel) {
        playLevelUpSound();
        lastLevel = currentLevel;
      }

      if (!isGameOver) {
        if (keys['ArrowLeft'] && player.x > 0) player.x -= PLAYER_SPEED;
        if (keys['ArrowRight'] && player.x < CANVAS_WIDTH - player.w)
          player.x += PLAYER_SPEED;
        if (keys['ArrowUp'] && player.y > 0) player.y -= PLAYER_SPEED;
        if (keys['ArrowDown'] && player.y < CANVAS_HEIGHT - player.h)
          player.y += PLAYER_SPEED;

        if (fireCooldown > 0) fireCooldown--;
        if ((keys['z'] || keys['Z']) && fireCooldown === 0) {
          const power = currentLevel;
          const size = getBulletSize(power);
          bullets.push({
            x: player.x + player.w / 2 - size.w / 2,
            y: player.y,
            w: size.w,
            h: size.h,
            power,
          });
          playShootSound();
          fireCooldown = FIRE_INTERVAL;
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
          bullets[i].y -= BULLET_SPEED;
          if (bullets[i].y + bullets[i].h < 0) bullets.splice(i, 1);
        }

        // 敵の生成(複数体同時)
        if (frameCount >= nextEnemySpawnFrame) {
          const lvIdx = currentLevel - 1;
          spawnEnemies(ENEMY_SPAWN_COUNTS[lvIdx], currentLevel);
          nextEnemySpawnFrame = frameCount + ENEMY_SPAWN_INTERVALS[lvIdx];
        }

        // 敵の更新
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          const lvIdx = e.level - 1;
          const speedY = ENEMY_SPEEDS_Y[lvIdx];
          e.y += speedY;
          e.x += e.vx;
          if (e.x < 0) {
            e.x = 0;
            e.vx = -e.vx;
          } else if (e.x + e.w > CANVAS_WIDTH) {
            e.x = CANVAS_WIDTH - e.w;
            e.vx = -e.vx;
          }
          if (e.y > CANVAS_HEIGHT) {
            enemies.splice(i, 1);
            continue;
          }

          // ダメージ点滅減衰
          if (e.damageFlash > 0) e.damageFlash--;

          // 敵の発射処理
          if (e.y > 0) {
            e.fireCooldown--;
            if (e.fireCooldown <= 0) {
              const speed = ENEMY_BULLET_SPEEDS[lvIdx];
              enemyBullets.push({
                x: e.x + e.w / 2 - 3,
                y: e.y + e.h,
                w: 6,
                h: 10,
                vx: (Math.random() - 0.5) * 1.5,
                vy: speed,
              });
              playEnemyShootSound();
              const base = ENEMY_FIRE_INTERVALS[lvIdx];
              e.fireCooldown = base + Math.floor(Math.random() * (base / 2));
            }
          }

          if (isHit(e, player)) {
            triggerGameOver();
          }
        }

        // 敵弾の更新
        const playerHitbox = getPlayerHitbox();
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const b = enemyBullets[i];
          b.x += b.vx;
          b.y += b.vy;
          if (b.y > CANVAS_HEIGHT || b.x + b.w < 0 || b.x > CANVAS_WIDTH) {
            enemyBullets.splice(i, 1);
            continue;
          }
          if (isHit(b, playerHitbox)) {
            enemyBullets.splice(i, 1);
            triggerGameOver();
          }
        }

        // 自機弾と敵の衝突(HP制対応)
        for (let i = bullets.length - 1; i >= 0; i--) {
          for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && isHit(bullets[i], enemies[j])) {
              bullets.splice(i, 1); // 弾は貫通せず消える
              enemies[j].hp--;
              enemies[j].damageFlash = 4; // 4フレーム点滅
              if (enemies[j].hp <= 0) {
                // 撃破
                const score = ENEMY_SCORES[enemies[j].level - 1];
                enemies.splice(j, 1);
                localScore += score;
                setScore(localScore);
                playExplosionSound();
              } else {
                // ダメージのみ
                playHitSound();
              }
              break;
            }
          }
        }

        frameCount++;
      }

      // プレイヤー描画
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2, player.y);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.closePath();
      ctx.fill();

      // 自機弾描画
      bullets.forEach((b) => {
        const colors = ['#fbbf24', '#fb923c', '#f87171', '#ec4899', '#a855f7'];
        ctx.fillStyle = colors[b.power - 1] || '#fbbf24';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      // 敵描画(ダメージ点滅対応)
      enemies.forEach((e) => {
        // 点滅中は白く、それ以外はレベル別色
        ctx.fillStyle =
          e.damageFlash > 0 ? '#ffffff' : ENEMY_COLORS[e.level - 1];
        ctx.fillRect(e.x, e.y, e.w, e.h);
        if (e.level >= 4) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(e.x, e.y, e.w, e.h);
        }
        // HPバー(画面内にいる時のみ・最大HPが2以上の場合)
        if (e.maxHp >= 2 && e.y > 0) {
          const barWidth = e.w;
          const barHeight = 3;
          const barY = e.y - 6;
          // 背景(暗赤)
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(e.x, barY, barWidth, barHeight);
          // 残HP(緑)
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(e.x, barY, barWidth * (e.hp / e.maxHp), barHeight);
        }
      });

      // 敵弾描画
      ctx.fillStyle = '#22d3ee';
      enemyBullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`LV ${currentLevel}`, CANVAS_WIDTH - 10, 20);

      if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.font = '20px sans-serif';
        ctx.fillText(
          `Score: ${localScore}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 20
        );
        ctx.font = '16px sans-serif';
        ctx.fillText(
          'Press RESTART button',
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 60
        );
      }

      animationId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [resetKey]);

  const handleRestart = () => {
    setScore(0);
    setGameOver(false);
    setResetKey((k) => k + 1);
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const toggleBGM = () => {
    setBgmEnabled((prev) => {
      const next = !prev;
      if (!next && bgmIntervalRef.current) {
        clearInterval(bgmIntervalRef.current);
        bgmIntervalRef.current = null;
        if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      }
      return next;
    });
  };

  const level = Math.min(
    Math.floor(score / POWER_UP_THRESHOLD) + 1,
    MAX_POWER_LEVEL
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        padding: '20px',
      }}
    >
      <h1 style={{ marginBottom: '10px' }}>Vertical Shooter</h1>
      <div
        style={{
          marginBottom: '10px',
          fontSize: '18px',
          display: 'flex',
          gap: '20px',
        }}
      >
        <span>Score: {score}</span>
        <span>
          LV: {level} / {MAX_POWER_LEVEL}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '2px solid #4ade80', background: '#0a0a1a' }}
      />
      <div style={{ marginTop: '15px', textAlign: 'center', lineHeight: 1.8 }}>
        <div>← ↑ ↓ → : 移動 / Z(押しっぱなし) : 連射</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          上位の敵はHP増加・複数体出現・全敵が攻撃
        </div>
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={toggleBGM}
            style={{
              padding: '6px 16px',
              fontSize: '14px',
              background: bgmEnabled ? '#4ade80' : '#666',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            BGM: {bgmEnabled ? 'ON' : 'OFF'}
          </button>
          {gameOver && (
            <button
              onClick={handleRestart}
              style={{
                padding: '6px 24px',
                fontSize: '14px',
                background: '#fbbf24',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              RESTART
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

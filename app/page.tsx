'use client';

import { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 8;
const ENEMY_SPEED = 2;
const ENEMY_SPAWN_INTERVAL = 60; // フレーム数
const STAR_COUNT = 80;

type Entity = { x: number; y: number; w: number; h: number };
type Bullet = Entity;
type Enemy = Entity;
type Star = { x: number; y: number; speed: number; size: number };

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ゲーム状態
    const player: Entity = {
      x: CANVAS_WIDTH / 2 - 15,
      y: CANVAS_HEIGHT - 60,
      w: 30,
      h: 30,
    };
    const bullets: Bullet[] = [];
    const enemies: Enemy[] = [];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: Math.random() * 2 + 0.5,
      size: Math.random() * 2 + 0.5,
    }));
    const keys: Record<string, boolean> = {};
    let frameCount = 0;
    let localScore = 0;
    let isGameOver = false;
    let animationId = 0;
    let zKeyProcessed = false;

    // キー入力
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'z', 'Z', ' '].includes(
          e.key
        )
      ) {
        e.preventDefault();
      }
      keys[e.key] = true;

      // Zキーで3連射(キーを押した瞬間のみ発射、押しっぱなしでは連射されない)
      if ((e.key === 'z' || e.key === 'Z') && !zKeyProcessed && !isGameOver) {
        zKeyProcessed = true;
        // 3連射(横に少しずつずらす)
        bullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 12 });
        bullets.push({
          x: player.x + player.w / 2 - 10,
          y: player.y + 5,
          w: 4,
          h: 12,
        });
        bullets.push({
          x: player.x + player.w / 2 + 6,
          y: player.y + 5,
          w: 4,
          h: 12,
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
      if (e.key === 'z' || e.key === 'Z') {
        zKeyProcessed = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 衝突判定
    const isHit = (a: Entity, b: Entity) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // メインループ
    const loop = () => {
      // 背景
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 星の描画とスクロール
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

      if (!isGameOver) {
        // プレイヤー操作
        if (keys['ArrowLeft'] && player.x > 0) player.x -= PLAYER_SPEED;
        if (keys['ArrowRight'] && player.x < CANVAS_WIDTH - player.w)
          player.x += PLAYER_SPEED;
        if (keys['ArrowUp'] && player.y > 0) player.y -= PLAYER_SPEED;
        if (keys['ArrowDown'] && player.y < CANVAS_HEIGHT - player.h)
          player.y += PLAYER_SPEED;

        // 弾の更新
        for (let i = bullets.length - 1; i >= 0; i--) {
          bullets[i].y -= BULLET_SPEED;
          if (bullets[i].y + bullets[i].h < 0) bullets.splice(i, 1);
        }

        // 敵の生成
        if (frameCount % ENEMY_SPAWN_INTERVAL === 0) {
          enemies.push({
            x: Math.random() * (CANVAS_WIDTH - 30),
            y: -30,
            w: 30,
            h: 30,
          });
        }

        // 敵の更新
        for (let i = enemies.length - 1; i >= 0; i--) {
          enemies[i].y += ENEMY_SPEED;
          if (enemies[i].y > CANVAS_HEIGHT) {
            enemies.splice(i, 1);
            continue;
          }
          // 敵とプレイヤーの衝突
          if (isHit(enemies[i], player)) {
            isGameOver = true;
            setGameOver(true);
          }
        }

        // 弾と敵の衝突
        for (let i = bullets.length - 1; i >= 0; i--) {
          for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && isHit(bullets[i], enemies[j])) {
              bullets.splice(i, 1);
              enemies.splice(j, 1);
              localScore += 10;
              setScore(localScore);
              break;
            }
          }
        }

        frameCount++;
      }

      // プレイヤーの描画(三角形の自機)
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2, player.y);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.closePath();
      ctx.fill();

      // 弾の描画
      ctx.fillStyle = '#fbbf24';
      bullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));

      // 敵の描画
      ctx.fillStyle = '#ef4444';
      enemies.forEach((e) => {
        ctx.fillRect(e.x, e.y, e.w, e.h);
      });

      // ゲームオーバー表示
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

    // クリーンアップ
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
  };

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
      <div style={{ marginBottom: '10px', fontSize: '20px' }}>
        Score: {score}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '2px solid #4ade80', background: '#0a0a1a' }}
      />
      <div style={{ marginTop: '15px', textAlign: 'center', lineHeight: 1.8 }}>
        <div>← ↑ ↓ → : 移動 / Z : 3連射</div>
        {gameOver && (
          <button
            onClick={handleRestart}
            style={{
              marginTop: '10px',
              padding: '8px 24px',
              fontSize: '16px',
              background: '#4ade80',
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
    </main>
  );
}

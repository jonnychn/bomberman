"use client"

import { cn } from "@/lib/utils"
import { useCallback, useState, useEffect } from "react"

const TileType = {
  EMPTY: 0,
  WALL: 1,
  DESTRUCTIBLE: 2,
  BOMB: 3,
  POWERUP: 4,
}

enum PowerUpType {
  BOMB_UP = "bombUp",
  FIRE_UP = "fireUp",
  SPEED_UP = "speedUp",
  EXTRA_LIFE = "extraLife",
}

const GRID_WIDTH = 10
const GRID_HEIGHT = 10
const CELL_SIZE = 50
const EXPLOSION_DURATION = 1000
const ENEMY_MOVE_INTERVAL = 800
const INITIAL_ENEMY_COUNT = 3

interface PlayerStats {
  maxBombs: number
  explosionRange: number
  moveSpeed: number
}

interface PowerUp {
  x: number
  y: number
  type: PowerUpType
  id: string
}

interface Enemy {
  id: string
  x: number
  y: number
  direction: "up" | "down" | "left" | "right"
  lastMoveTime: number
}

const Page = () => {
  // Added audio context for sound effects
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)

  // Initialize audio context
  useEffect(() => {
    const initAudio = () => {
      if (!audioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(ctx)
      }
    }

    // Initialize on first user interaction
    const handleFirstInteraction = () => {
      initAudio()
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
    }

    document.addEventListener("click", handleFirstInteraction)
    document.addEventListener("keydown", handleFirstInteraction)

    return () => {
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
    }
  }, [audioContext])

  // Added sound effect functions
  const playSound = useCallback(
    (frequency: number, duration: number, type: "sine" | "square" | "triangle" = "sine") => {
      if (!audioContext) return

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = type

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)
    },
    [audioContext],
  )

  const [gameState, setGameState] = useState(() => {
    const enemies: Enemy[] = []

    const enemySpawns = [
      { x: GRID_WIDTH - 1, y: 0 },
      { x: 0, y: GRID_HEIGHT - 1 },
      { x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 },
    ]

    enemySpawns.forEach((spawn, index) => {
      if (index < INITIAL_ENEMY_COUNT) {
        enemies.push({
          id: `enemy-${index}`,
          x: spawn.x,
          y: spawn.y,
          direction: ["up", "down", "left", "right"][Math.floor(Math.random() * 4)] as any,
          lastMoveTime: Date.now(),
        })
      }
    })

    return {
      grid: Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => TileType.EMPTY)),
      playerPos: { x: 0, y: 0 },
      playerStats: {
        maxBombs: 1,
        explosionRange: 2,
        moveSpeed: 1,
      } as PlayerStats,
      powerUps: [] as PowerUp[],
      enemies,
      bombs: [],
      explosions: [],
      score: 0,
      lives: 3,
      gameStatus: "playing",
    }
  })

  const restartGame = useCallback(() => {
    // Added restart sound effect
    playSound(440, 0.2, "triangle")

    const enemies: Enemy[] = []
    const enemySpawns = [
      { x: GRID_WIDTH - 1, y: 0 },
      { x: 0, y: GRID_HEIGHT - 1 },
      { x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 },
    ]

    enemySpawns.forEach((spawn, index) => {
      if (index < INITIAL_ENEMY_COUNT) {
        enemies.push({
          id: `enemy-${index}`,
          x: spawn.x,
          y: spawn.y,
          direction: ["up", "down", "left", "right"][Math.floor(Math.random() * 4)] as any,
          lastMoveTime: Date.now(),
        })
      }
    })

    setGameState({
      grid: Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => TileType.EMPTY)),
      playerPos: { x: 0, y: 0 },
      playerStats: {
        maxBombs: 1,
        explosionRange: 2,
        moveSpeed: 1,
      },
      powerUps: [],
      enemies,
      bombs: [],
      explosions: [],
      score: 0,
      lives: 3,
      gameStatus: "playing",
    })
  }, [playSound])

  // Added pause/resume functionality
  const togglePause = useCallback(() => {
    setGameState((prevState) => ({
      ...prevState,
      gameStatus: prevState.gameStatus === "playing" ? "paused" : "playing",
    }))
    playSound(330, 0.1, "square")
  }, [playSound])

  const createExplosion = useCallback(
    (bombX: number, bombY: number) => {
      // Added explosion sound effect
      playSound(150, 0.3, "square")

      setGameState((prevState) => {
        const { grid, enemies, playerStats } = prevState
        const explosionPositions: { x: number; y: number }[] = []
        const newGrid = grid.map((row) => [...row])
        const newPowerUps = [...prevState.powerUps]
        let blocksDestroyed = 0
        let enemiesDestroyed = 0

        explosionPositions.push({ x: bombX, y: bombY })

        const directions = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ]

        directions.forEach(({ dx, dy }) => {
          for (let i = 1; i <= playerStats.explosionRange; i++) {
            const newX = bombX + dx * i
            const newY = bombY + dy * i

            if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) break

            const tile = grid[newY][newX]
            if (tile === TileType.WALL) break

            explosionPositions.push({ x: newX, y: newY })

            if (tile === TileType.DESTRUCTIBLE) {
              newGrid[newY][newX] = TileType.EMPTY
              blocksDestroyed++

              if (Math.random() < 0.4) {
                const powerUpTypes = Object.values(PowerUpType)
                const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]

                newPowerUps.push({
                  x: newX,
                  y: newY,
                  type: randomType,
                  id: `powerup-${Date.now()}-${Math.random()}`,
                })
              }
              break
            }
          }
        })

        const survivingEnemies = enemies.filter((enemy) => {
          const enemyHit = explosionPositions.some((exp) => exp.x === enemy.x && exp.y === enemy.y)
          if (enemyHit) {
            enemiesDestroyed++
            // Added enemy destruction sound
            playSound(200, 0.2, "triangle")
          }
          return !enemyHit
        })

        const scoreIncrease = blocksDestroyed * 100 + enemiesDestroyed * 200
        const remainingBlocks = newGrid.flat().filter((tile) => tile === TileType.DESTRUCTIBLE).length
        const newGameStatus = remainingBlocks === 0 && survivingEnemies.length === 0 ? "victory" : prevState.gameStatus

        // Added victory sound
        if (newGameStatus === "victory") {
          playSound(523, 0.5, "sine") // C note
          setTimeout(() => playSound(659, 0.5, "sine"), 200) // E note
          setTimeout(() => playSound(784, 0.8, "sine"), 400) // G note
        }

        return {
          ...prevState,
          grid: newGrid,
          powerUps: newPowerUps,
          enemies: survivingEnemies,
          explosions: explosionPositions,
          score: prevState.score + scoreIncrease,
          gameStatus: newGameStatus,
        }
      })

      setTimeout(() => {
        setGameState((prevState) => ({
          ...prevState,
          explosions: [],
        }))
      }, EXPLOSION_DURATION)
    },
    [playSound],
  )

  // Enhanced tile styling with better animations
  const getTileStyle = (tileType: number, x: number, y: number) => {
    const baseClasses =
      "w-10 h-10 border border-gray-800 flex items-center justify-center text-lg font-bold transition-all duration-200 relative overflow-hidden"

    const hasExplosion = gameState.explosions.some((exp) => exp.x === x && exp.y === y)
    if (hasExplosion) {
      return cn(baseClasses, "bg-red-500 animate-pulse shadow-lg shadow-red-400 scale-110")
    }

    const powerUp = gameState.powerUps.find((p) => p.x === x && p.y === y)
    if (powerUp) {
      switch (powerUp.type) {
        case PowerUpType.BOMB_UP:
          return cn(baseClasses, "bg-blue-400 animate-bounce shadow-lg shadow-blue-300")
        case PowerUpType.FIRE_UP:
          return cn(baseClasses, "bg-red-400 animate-bounce shadow-lg shadow-red-300")
        case PowerUpType.SPEED_UP:
          return cn(baseClasses, "bg-green-500 animate-bounce shadow-lg shadow-green-300")
        case PowerUpType.EXTRA_LIFE:
          return cn(baseClasses, "bg-pink-400 animate-bounce shadow-lg shadow-pink-300")
      }
    }

    switch (tileType) {
      case TileType.EMPTY:
        return cn(baseClasses, "bg-green-400 hover:bg-green-300")
      case TileType.WALL:
        return cn(baseClasses, "bg-gray-600 shadow-inner")
      case TileType.DESTRUCTIBLE:
        return cn(baseClasses, "bg-orange-400 shadow-sm hover:bg-orange-300")
      case TileType.BOMB:
        return cn(baseClasses, "bg-red-600 animate-bounce shadow-lg shadow-red-500")
      default:
        return cn(baseClasses, "bg-green-400")
    }
  }

  const getTileContent = (tileType: number, x: number, y: number) => {
    const { playerPos, enemies, bombs, explosions, powerUps } = gameState

    const hasExplosion = explosions.some((exp) => exp.x === x && exp.y === y)
    if (hasExplosion) {
      return "💥"
    }

    const bomb = bombs.find((b) => b.x === x && b.y === y)
    if (bomb) {
      return `💣`
    }

    const enemy = enemies.find((e) => e.x === x && e.y === y)
    if (enemy) {
      return "👾"
    }

    if (x === playerPos.x && y === playerPos.y) {
      return "🤖"
    }

    const powerUp = powerUps.find((p) => p.x === x && p.y === y)
    if (powerUp) {
      switch (powerUp.type) {
        case PowerUpType.BOMB_UP:
          return "💣"
        case PowerUpType.FIRE_UP:
          return "🔥"
        case PowerUpType.SPEED_UP:
          return "⚡"
        case PowerUpType.EXTRA_LIFE:
          return "❤️"
      }
    }

    switch (tileType) {
      case TileType.WALL:
        return "🧱"
      case TileType.DESTRUCTIBLE:
        return "📦"
      default:
        return ""
    }
  }

  const movePlayer = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (gameState.gameStatus !== "playing") return

      // Added movement sound effect
      playSound(880, 0.05, "square")

      setGameState((prevState) => {
        const { playerPos, grid, bombs, enemies, powerUps, playerStats } = prevState
        let newX = playerPos.x
        let newY = playerPos.y

        switch (direction) {
          case "up":
            newY = Math.max(0, playerPos.y - 1)
            break
          case "down":
            newY = Math.min(GRID_HEIGHT - 1, playerPos.y + 1)
            break
          case "left":
            newX = Math.max(0, playerPos.x - 1)
            break
          case "right":
            newX = Math.min(GRID_WIDTH - 1, playerPos.x + 1)
            break
        }

        const targetTile = grid[newY][newX]
        if (targetTile === TileType.WALL || targetTile === TileType.DESTRUCTIBLE) {
          return prevState
        }

        const bombAtTarget = bombs.find((bomb) => bomb.x === newX && bomb.y === newY)
        if (bombAtTarget) {
          return prevState
        }

        const enemyAtTarget = enemies.find((enemy) => enemy.x === newX && enemy.y === newY)
        if (enemyAtTarget) {
          return prevState
        }

        const powerUpAtTarget = powerUps.find((p) => p.x === newX && p.y === newY)
        let newPlayerStats = playerStats
        let scoreBonus = 0
        let newLives = prevState.lives
        let newPowerUps = powerUps

        if (powerUpAtTarget) {
          newPowerUps = powerUps.filter((p) => p.id !== powerUpAtTarget.id)
          scoreBonus = 500

          // Added power-up collection sound
          playSound(660, 0.3, "sine")

          switch (powerUpAtTarget.type) {
            case PowerUpType.BOMB_UP:
              newPlayerStats = { ...playerStats, maxBombs: Math.min(playerStats.maxBombs + 1, 5) }
              break
            case PowerUpType.FIRE_UP:
              newPlayerStats = { ...playerStats, explosionRange: Math.min(playerStats.explosionRange + 1, 6) }
              break
            case PowerUpType.SPEED_UP:
              newPlayerStats = { ...playerStats, moveSpeed: Math.min(playerStats.moveSpeed + 0.5, 3) }
              break
            case PowerUpType.EXTRA_LIFE:
              newLives = Math.min(prevState.lives + 1, 9)
              // Special sound for extra life
              playSound(523, 0.2, "sine")
              setTimeout(() => playSound(659, 0.2, "sine"), 100)
              break
          }
        }

        return {
          ...prevState,
          playerPos: { x: newX, y: newY },
          playerStats: newPlayerStats,
          powerUps: newPowerUps,
          lives: newLives,
          score: prevState.score + scoreBonus,
        }
      })
    },
    [gameState, playSound],
  )

  const placeBomb = useCallback(() => {
    if (gameState.gameStatus !== "playing") return

    setGameState((prevState) => {
      const { playerPos, bombs, playerStats } = prevState

      // Check if player already has max bombs placed
      if (bombs.length >= playerStats.maxBombs) return prevState

      // Check if there's already a bomb at player position
      const existingBomb = bombs.find((bomb) => bomb.x === playerPos.x && bomb.y === playerPos.y)
      if (existingBomb) return prevState

      playSound(440, 0.2, "square")

      const newBomb = {
        x: playerPos.x,
        y: playerPos.y,
        id: `bomb-${Date.now()}`,
        timer: 3000, // 3 seconds
      }

      // Set timer for bomb explosion
      setTimeout(() => {
        setGameState((currentState) => {
          const bombStillExists = currentState.bombs.find((b) => b.id === newBomb.id)
          if (bombStillExists) {
            return {
              ...currentState,
              bombs: currentState.bombs.filter((b) => b.id !== newBomb.id),
            }
          }
          return currentState
        })
        createExplosion(newBomb.x, newBomb.y)
      }, newBomb.timer)

      return {
        ...prevState,
        bombs: [...bombs, newBomb],
      }
    })
  }, [gameState.gameStatus, playSound, createExplosion])

  useEffect(() => {
    if (gameState.gameStatus !== "playing") return

    const moveEnemies = () => {
      setGameState((prevState) => {
        const { enemies, playerPos, grid, bombs } = prevState
        const currentTime = Date.now()

        const updatedEnemies = enemies.map((enemy) => {
          // Only move if enough time has passed
          if (currentTime - enemy.lastMoveTime < ENEMY_MOVE_INTERVAL) {
            return enemy
          }

          // Calculate distance to player
          const distanceToPlayer = Math.abs(enemy.x - playerPos.x) + Math.abs(enemy.y - playerPos.y)

          // 70% chance to move towards player, 30% random movement
          const shouldChasePlayer = Math.random() < 0.7 && distanceToPlayer > 1

          const possibleMoves: Array<{ x: number; y: number; direction: typeof enemy.direction }> = []

          // Check all four directions
          const directions = [
            { dx: 0, dy: -1, dir: "up" as const },
            { dx: 0, dy: 1, dir: "down" as const },
            { dx: -1, dy: 0, dir: "left" as const },
            { dx: 1, dy: 0, dir: "right" as const },
          ]

          directions.forEach(({ dx, dy, dir }) => {
            const newX = enemy.x + dx
            const newY = enemy.y + dy

            // Check bounds
            if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) return

            // Check for walls and destructible blocks
            const tile = grid[newY][newX]
            if (tile === TileType.WALL || tile === TileType.DESTRUCTIBLE) return

            // Check for bombs
            const bombAtPosition = bombs.find((bomb) => bomb.x === newX && bomb.y === newY)
            if (bombAtPosition) return

            // Check for other enemies
            const enemyAtPosition = enemies.find(
              (otherEnemy) => otherEnemy.id !== enemy.id && otherEnemy.x === newX && otherEnemy.y === newY,
            )
            if (enemyAtPosition) return

            possibleMoves.push({ x: newX, y: newY, direction: dir })
          })

          if (possibleMoves.length === 0) {
            return { ...enemy, lastMoveTime: currentTime }
          }

          let chosenMove
          if (shouldChasePlayer) {
            // Choose move that gets closer to player
            chosenMove = possibleMoves.reduce((best, move) => {
              const moveDistance = Math.abs(move.x - playerPos.x) + Math.abs(move.y - playerPos.y)
              const bestDistance = Math.abs(best.x - playerPos.x) + Math.abs(best.y - playerPos.y)
              return moveDistance < bestDistance ? move : best
            })
          } else {
            // Random movement
            chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
          }

          return {
            ...enemy,
            x: chosenMove.x,
            y: chosenMove.y,
            direction: chosenMove.direction,
            lastMoveTime: currentTime,
          }
        })

        const playerHitByEnemy = updatedEnemies.some((enemy) => enemy.x === playerPos.x && enemy.y === playerPos.y)

        if (playerHitByEnemy) {
          playSound(220, 1.0, "square")

          const newLives = prevState.lives - 1
          if (newLives <= 0) {
            return {
              ...prevState,
              enemies: updatedEnemies,
              gameStatus: "gameOver",
              lives: 0,
            }
          } else {
            // Reset player position and reduce lives
            return {
              ...prevState,
              enemies: updatedEnemies,
              playerPos: { x: 0, y: 0 }, // Reset to starting position
              lives: newLives,
            }
          }
        }

        return {
          ...prevState,
          enemies: updatedEnemies,
        }
      })
    }

    const enemyMoveInterval = setInterval(moveEnemies, 200) // Move enemies every 200ms
    return () => clearInterval(enemyMoveInterval)
  }, [gameState.gameStatus, playSound])

  // Enhanced keyboard controls with pause functionality
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault()
          movePlayer("up")
          break
        case "ArrowDown":
        case "s":
        case "S":
          event.preventDefault()
          movePlayer("down")
          break
        case "ArrowLeft":
        case "a":
        case "A":
          event.preventDefault()
          movePlayer("left")
          break
        case "ArrowRight":
        case "d":
        case "D":
          event.preventDefault()
          movePlayer("right")
          break
        case " ":
        case "Spacebar":
          event.preventDefault()
          placeBomb()
          break
        case "p":
        case "P":
        case "Escape":
          event.preventDefault()
          togglePause()
          break
        case "r":
        case "R":
          if (gameState.gameStatus === "gameOver" || gameState.gameStatus === "victory") {
            event.preventDefault()
            restartGame()
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [movePlayer, togglePause, restartGame, gameState.gameStatus, placeBomb])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col items-center justify-center p-4">
      {/* Enhanced game header with better styling */}
      <div className="mb-6 text-center">
        <h1 className="text-5xl font-bold text-white mb-3 font-mono tracking-wider drop-shadow-lg animate-pulse">
          BOMBERMAN
        </h1>

        <div className="flex gap-6 text-white font-mono mb-2 text-lg">
          <div className="bg-black bg-opacity-50 px-3 py-1 rounded">
            SCORE: {gameState.score.toString().padStart(6, "0")}
          </div>
          <div className="bg-black bg-opacity-50 px-3 py-1 rounded">LIVES: {gameState.lives}</div>
          <div className="bg-black bg-opacity-50 px-3 py-1 rounded">ENEMIES: {gameState.enemies.length}</div>
        </div>

        <div className="flex gap-4 text-sm text-yellow-200 font-mono">
          <div className="bg-black bg-opacity-30 px-2 py-1 rounded">💣 BOMBS: {gameState.playerStats.maxBombs}</div>
          <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
            🔥 RANGE: {gameState.playerStats.explosionRange}
          </div>
          <div className="bg-black bg-opacity-30 px-2 py-1 rounded">
            ⚡ SPEED: {gameState.playerStats.moveSpeed.toFixed(1)}
          </div>
        </div>

        {/* Enhanced pause overlay */}
        {gameState.gameStatus === "paused" && (
          <div className="mt-3">
            <div className="text-yellow-300 font-bold text-2xl animate-pulse mb-2">⏸️ PAUSED ⏸️</div>
            <p className="text-white text-sm">Press P or ESC to resume</p>
          </div>
        )}

        {gameState.gameStatus === "victory" && (
          <div className="mt-3">
            <div className="text-yellow-300 font-bold text-xl animate-bounce mb-2">
              🎉 VICTORY! ALL BLOCKS AND ENEMIES DESTROYED! 🎉
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={restartGame}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-all transform hover:scale-105"
              >
                PLAY AGAIN
              </button>
            </div>
            <p className="text-white text-xs mt-1">Press R to restart</p>
          </div>
        )}

        {gameState.gameStatus === "gameOver" && (
          <div className="mt-3">
            <div className="text-red-300 font-bold text-xl animate-pulse mb-2">💀 GAME OVER! 💀</div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={restartGame}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-all transform hover:scale-105"
              >
                TRY AGAIN
              </button>
            </div>
            <p className="text-white text-xs mt-1">Press R to restart</p>
          </div>
        )}
      </div>

      {/* Enhanced game board with better shadow and border effects */}
      <div
        className="bg-black p-3 rounded-xl shadow-2xl border-4 border-yellow-400 relative"
        style={{
          width: GRID_WIDTH * CELL_SIZE + 24,
          height: GRID_HEIGHT * CELL_SIZE + 24,
        }}
      >
        {/* Added pause overlay */}
        {gameState.gameStatus === "paused" && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="text-white text-4xl font-bold animate-pulse">⏸️</div>
          </div>
        )}

        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${GRID_WIDTH}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_HEIGHT}, ${CELL_SIZE}px)`,
          }}
        >
          {gameState.grid.map((row, y) =>
            row.map((tile, x) => (
              <div key={`${x}-${y}`} className={getTileStyle(tile, x, y)}>
                {getTileContent(tile, x, y)}
              </div>
            )),
          )}
        </div>
      </div>

      {/* Enhanced controls info with better styling */}
      <div className="mt-6 text-center text-white font-mono bg-black bg-opacity-30 p-4 rounded-lg">
        <p className="text-sm mb-1">🎮 ARROW KEYS or WASD to move • SPACE to place bomb • P to pause</p>
        <p className="text-xs opacity-75 mb-2">Destroy all blocks and enemies to win!</p>

        <div className="text-xs opacity-75 space-y-1">
          <p>🎁 Power-ups: 💣 More Bombs • 🔥 Bigger Explosions • ⚡ Faster Movement • ❤️ Extra Life</p>
          <p>🏆 Scoring: Blocks 100pts • Enemies 200pts • Power-ups 500pts</p>
        </div>
      </div>
    </div>
  )
}

export default Page

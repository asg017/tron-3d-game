import './style.css'
import { Game } from './game'
import { showStartScreen } from './ui/startScreen'

const sceneEl = document.getElementById('scene')!

function menu(): void {
  showStartScreen((setup) => {
    const game = new Game(sceneEl, setup, menu)
    game.start()
  })
}

menu()

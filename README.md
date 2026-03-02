# Bingo Game

## Overview
This Bingo game project allows users to generate random balls, create bingo cards, and play the game with interactive features. The game includes sound effects, animations, and a user-friendly interface.

## Project Structure
```
bingo-game
├── src
│   ├── index.html        # HTML structure of the Bingo game
│   ├── script.js         # JavaScript logic for game functionality
│   └── styles.css        # CSS styles for layout and design
├── sounds
│   ├── spin-sound.mp3    # Sound for spinning animation
│   └── winner-sound.mp3  # Sound for winning announcement
├── package.json          # npm configuration file
└── README.md             # Project documentation
```

## Features
- **Random Ball Generation**: A button to generate a random ball with a spinning animation and sound for 4 seconds.
- **Bingo Card Generation**: Users can input the number of bingo cards to generate, which will be displayed in a grid format.
- **Game Mode Display**: The current game mode updates from "line" to "bingo" after a line win.
- **Prize Box**: A hidden prize box that can be toggled by clicking a designated area.
- **Ball Count Display**: Displays the count of drawn balls, starting from 0/75.
- **Editable Card Names**: Each generated card has an editable name field.
- **Interactivity**: Sound effects for spinning and winning, marking drawn balls in red, and matched cells in green.
- **Winning Conditions**: Identifies winners for line and full card, highlighting winning cards in yellow.
- **Bingo Card Structure**: Each card is a 5x5 grid with specific number distributions and a free space in the center.
- **Prize Calculation**: Parameters for setting card prices and calculating prize amounts based on the number of cards sold.

## Getting Started
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd bingo-game
   ```
3. Install dependencies (if any):
   ```
   npm install
   ```
4. Open `src/index.html` in a web browser to play the game.

## License
This project is licensed under the MIT License.
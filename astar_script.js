// script.js - A* Pathfinding Visualizer

class Node {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.g = 0; // cost from start
        this.h = 0; // heuristic cost to end
        this.f = 0; // total cost
        /*As the algorithm progresses, 
        * each node will keep track of its 
        * parent node to make a path once
        *  the end node is reached.
        **/
        this.parent = null;
        this.isObstacle = false;
        this.isStart = false;
        this.isEnd = false;
        this.isPath = false;
        this.isExplored = false;
        this.isFrontier = false;
    }
}

class Particle {  //colored bursts
    constructor(x, y, color, speed = 2) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.speed = speed;
        this.life = 1.0;
        this.decay = 0.02;
        this.size = Math.random() * 3 + 2; //[2,5)
        this.vx = (Math.random() - 0.5) * 2;  // [-1,1) good for any direction
        this.vy = (Math.random() - 0.5) * 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        //fade out
        this.life -= this.decay;
        //shrink by 2% each frame
        this.size *= 0.98;
    }

    draw(ctx) {  //actually render particle on canvas
        //save current state
        ctx.save();
        //transparency based on life
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        //restore original canvas state
        ctx.restore();
    }
}

class MovingObstacle {
    constructor(x, y, dx = 1, dy = 0, speed = 0.5) {
        this.x = x;
        this.y = y;
        this.dx = dx; // direction x
        this.dy = dy; // direction y
        this.speed = speed;
        this.counter = 0; // for timing movement
    }

    update(cols, rows) {
        this.counter += this.speed;
        if (this.counter >= 1) {
            // Move to next position
            this.x += this.dx;
            this.y += this.dy;
            
            // Bounce off edges
            if (this.x <= 0 || this.x >= cols - 1) {
                this.dx *= -1;
                this.x = Math.max(0, Math.min(cols - 1, this.x));
            }
            if (this.y <= 0 || this.y >= rows - 1) {
                this.dy *= -1;
                this.y = Math.max(0, Math.min(rows - 1, this.y));
            }
            
            this.counter = 0;
        }
    }
}

class AStarVisualizer {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.cols = Math.floor(this.canvas.width / this.gridSize);
        this.rows = Math.floor(this.canvas.height / this.gridSize);

        this.grid = [];
        this.openSet = [];
        this.closedSet = [];
        this.path = [];
        this.particles = [];

        this.start = null;
        this.end = null;
        this.isPlacingStart = true;
        this.isDrawingObstacles = false;
        this.isRunning = false;
        this.animationEnabled = true;
        this.animationSpeed = 50; // milliseconds between steps
        
        // Dynamic obstacles
        this.movingObstacles = [];
        this.dynamicObstaclesEnabled = false;

        this.initGrid();
        this.setupEventListeners();
        this.animate();
    }

    initGrid() {
        for (let i = 0; i < this.cols; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j] = new Node(i, j);
            }
        }
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.isDrawingObstacles = false);

        // Button events
        document.getElementById('startBtn').addEventListener('click', () => this.startPathfinding());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearPath());
        document.getElementById('randomObstaclesBtn').addEventListener('click', () => this.generateRandomObstacles());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('animateBtn').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('dynamicObstaclesBtn').addEventListener('click', () => this.toggleDynamicObstacles());
        document.getElementById('addMovingObstaclesBtn').addEventListener('click', () => this.generateMovingObstacles());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - rect.left) / this.gridSize),
            y: Math.floor((e.clientY - rect.top) / this.gridSize)
        };
    }

    handleMouseDown(e) {
        if (this.isRunning) return;

        const pos = this.getMousePos(e);
        if (pos.x < 0 || pos.x >= this.cols || pos.y < 0 || pos.y >= this.rows) return;

        const node = this.grid[pos.x][pos.y];

        if (this.isPlacingStart) {
            this.clearStartEnd();
            node.isStart = true;
            this.start = node;
            this.isPlacingStart = false;
            this.addParticles(pos.x * this.gridSize + this.gridSize/2, pos.y * this.gridSize + this.gridSize/2, '#00ff00');
        } else if (!this.start || (this.start && !this.end)) {
            if (!node.isStart) {
                node.isEnd = true;
                this.end = node;
                this.addParticles(pos.x * this.gridSize + this.gridSize/2, pos.y * this.gridSize + this.gridSize/2, '#ff0000');
            }
        } else {
            if (!node.isStart && !node.isEnd) {
                node.isObstacle = !node.isObstacle;
                this.isDrawingObstacles = true;
            }
        }
    }

    handleMouseMove(e) {
        if (!this.isDrawingObstacles || this.isRunning) return;

        const pos = this.getMousePos(e);
        if (pos.x < 0 || pos.x >= this.cols || pos.y < 0 || pos.y >= this.rows) return;
        
        const node = this.grid[pos.x][pos.y];
        if (!node.isStart && !node.isEnd) {
            node.isObstacle = true;
        }
    }

    clearStartEnd() {
        if (this.start) {
            this.start.isStart = false;
            this.start = null;
        }
        if (this.end) {
            this.end.isEnd = false;
            this.end = null;
        }
        this.isPlacingStart = true;
    }

    clearPath() {
        this.openSet = [];
        this.closedSet = [];
        this.path = [];
        
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                node.g = 0;
                node.h = 0;
                node.f = 0;
                node.parent = null;
                node.isPath = false;
                node.isExplored = false;
                node.isFrontier = false;
            }
        }
    }

    clearAll() {
        this.clearPath();
        this.clearStartEnd();
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j].isObstacle = false;
            }
        }
        this.particles = [];
        this.movingObstacles = [];
    }

    generateRandomObstacles() {
        this.clearPath();
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                if (!node.isStart && !node.isEnd && Math.random() < 0.3) {
                    node.isObstacle = true;
                }
            }
        }
    }

    toggleAnimation() {
        this.animationEnabled = !this.animationEnabled;
        const btn = document.getElementById('animateBtn');
        btn.textContent = this.animationEnabled ? 'Disable Animation' : 'Enable Animation';
    }

    addParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    // Manhattan distance only (perfect for 4-directional grid movement)
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    getNeighbors(node) {
        const neighbors = [];
        const x = node.x;
        const y = node.y;

        // 4 cardinal directions only
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        directions.forEach(dir => {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows) {
                const neighbor = this.grid[newX][newY];
                
                // Check if it's a moving obstacle
                const isMovingObstacle = this.movingObstacles.some(obs => 
                    Math.floor(obs.x) === newX && Math.floor(obs.y) === newY
                );
                
                if (!neighbor.isObstacle && !isMovingObstacle) {
                    neighbors.push(neighbor);
                }
            }
        });

        return neighbors;
    }

    reconstructPath(current) {
        this.path = [];
        while (current) {
            this.path.unshift(current);
            current = current.parent;
        }

        this.path.forEach((node, index) => {
            if (!node.isStart && !node.isEnd) {
                node.isPath = true;
                setTimeout(() => {
                    this.addParticles(
                        node.x * this.gridSize + this.gridSize / 2,
                        node.y * this.gridSize + this.gridSize / 2,
                        '#ffff00',
                        5
                    );
                }, index * 50);
            }
        });
    }

    async startPathfinding() {
        if (!this.start || !this.end) {
            alert('Please place both start and end points');
            return;
        }

        this.clearPath();
        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;

        this.openSet = [this.start];
        this.start.g = 0;
        this.start.h = this.heuristic(this.start, this.end);
        this.start.f = this.start.h;

        while (this.openSet.length > 0) {
            // Find node with lowest f score
            let current = this.openSet[0];
            let currentIndex = 0;

            for (let i = 1; i < this.openSet.length; i++) {
                if (this.openSet[i].f < current.f) {
                    current = this.openSet[i];
                    currentIndex = i;
                }
            }

            // Move current from open to closed set
            this.openSet.splice(currentIndex, 1);
            this.closedSet.push(current);
            current.isExplored = true;

            // Add exploration particles
            this.addParticles(
                current.x * this.gridSize + this.gridSize / 2,
                current.y * this.gridSize + this.gridSize / 2,
                '#00ffff',
                3
            );

            // Check if we reached the goal
            if (current === this.end) {
                this.reconstructPath(current);
                this.isRunning = false;
                document.getElementById('startBtn').disabled = false;
                return;
            }

            // Check all neighbors
            const neighbors = this.getNeighbors(current);

            for (const neighbor of neighbors) {
                if (this.closedSet.includes(neighbor)) continue;

                const tentativeG = current.g + 1;

                if (!this.openSet.includes(neighbor)) {
                    this.openSet.push(neighbor);
                    neighbor.isFrontier = true;
                    this.addParticles(
                        neighbor.x * this.gridSize + this.gridSize / 2,
                        neighbor.y * this.gridSize + this.gridSize / 2,
                        '#ff00ff',
                        2
                    );
                } else if (tentativeG >= neighbor.g) {
                    continue;
                }

                neighbor.parent = current;
                neighbor.g = tentativeG;
                neighbor.h = this.heuristic(neighbor, this.end);
                neighbor.f = neighbor.g + neighbor.h;
            }

            // Animation delay
            if (this.animationEnabled) {
                await new Promise(resolve => setTimeout(resolve, this.animationSpeed));
            }
        }

        // No path found
        alert('No path found!');
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
    }

    // Dynamic obstacle methods
    toggleDynamicObstacles() {
        this.dynamicObstaclesEnabled = !this.dynamicObstaclesEnabled;
        const btn = document.getElementById('dynamicObstaclesBtn');
        btn.textContent = this.dynamicObstaclesEnabled ? 'Disable Dynamic Obstacles' : 'Enable Dynamic Obstacles';
    }

    generateMovingObstacles() {
        this.movingObstacles = [];
        const count = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            const dx = Math.random() > 0.5 ? 1 : -1;
            const dy = Math.random() > 0.5 ? 1 : -1;
            this.movingObstacles.push(new MovingObstacle(x, y, dx, dy));
        }
    }

    updateMovingObstacles() {
        if (this.dynamicObstaclesEnabled) {
            this.movingObstacles.forEach(obstacle => {
                obstacle.update(this.cols, this.rows);
            });
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;

        for (let i = 0; i <= this.cols; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
        }

        for (let j = 0; j <= this.rows; j++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j * this.gridSize);
            this.ctx.lineTo(this.canvas.width, j * this.gridSize);
            this.ctx.stroke();
        }

        // Draw nodes with enhanced visuals
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                const x = i * this.gridSize;
                const y = j * this.gridSize;

                if (node.isObstacle) {
                    this.ctx.fillStyle = '#333';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isStart) {
                    this.ctx.shadowColor = '#00ff00';
                    this.ctx.shadowBlur = 10;
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                    this.ctx.shadowBlur = 0;
                } else if (node.isEnd) {
                    this.ctx.shadowColor = '#ff0000';
                    this.ctx.shadowBlur = 10;
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                    this.ctx.shadowBlur = 0;
                } else if (node.isPath) {
                    this.ctx.shadowColor = '#ffff00';
                    this.ctx.shadowBlur = 5;
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                    this.ctx.shadowBlur = 0;
                } else if (node.isExplored) {
                    const gradient = this.ctx.createLinearGradient(x, y, x + this.gridSize, y + this.gridSize);
                    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
                    gradient.addColorStop(1, 'rgba(0, 150, 150, 0.3)');
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isFrontier) {
                    this.ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                }
            }
        }

        // Draw moving obstacles
        this.movingObstacles.forEach(obstacle => {
            const x = obstacle.x * this.gridSize;
            const y = obstacle.y * this.gridSize;
            
            this.ctx.fillStyle = '#ff6600';
            this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
            
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, this.gridSize, this.gridSize);
        });

        // Draw particles
        this.particles = this.particles.filter(particle => {
            particle.update(); 
            particle.draw(this.ctx);
            return particle.life > 0;
        });
    }

    animate() {
        this.updateMovingObstacles();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AStarVisualizer();
});
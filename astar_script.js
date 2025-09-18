// script.js - A* Pathfinding Visualizer

class Node {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.g = 0; // tracks the cost from the start node to this node
        this.h = 0; // is the heuristic estimate of the cost from this node to the end node
        this.f = 0; // total cost f = g + h

        // As the algorithm explores the grid, 
        // it keeps track of each node’s parent so that, 
        // once the end node is reached, it can reconstruct 
        // the shortest path by following the chain of parent links 
        // backward from the end node to the start node.

        //no previous node
        this.parent = null;

        //properties
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
        this.vy = (Math.random() - 0.5) * 2;  // [-1,1)
        //consistent movement speed for all particles:
        const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        //normalize using mag to get unit vector (1), then scale by speed we set
        this.vx = (this.vx / mag) * this.speed;
        this.vy = (this.vy / mag) * this.speed;
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
        // on canvas, circle drawn at each particle position x,y 
        // and 0 to 2PI radians
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        //retrieve what we saved to do more
        ctx.restore();
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

        this.initGrid();
        this.setupEventListeners();
        // Start the animation loop
        this.animate();
    }

    initGrid() {
        this.grid = [];
        for (let i = 0; i < this.cols; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j] = new Node(i, j);
            }
        }
    }

    setupEventListeners() { // mouse + button events on canvas
        // click down on mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        // drag mouse
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        // finish a mouse drag and click up
        this.canvas.addEventListener('mouseup', () => this.isDrawingObstacles = false);

        // make event listeners for buttons, connected by their html IDs
        // javascript arrow functions () => {} bind the 'this' context lexically,
        // inheriting from the scope of the class instance
        document.getElementById('startBtn').addEventListener('click', () => this.startPathfinding());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearPath());
        document.getElementById('randomObstaclesBtn').addEventListener('click', () => this.generateRandomObstacles());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('animateBtn').addEventListener('click', () => this.toggleAnimation());
    }

    getMousePos(e) {  //get mouse event (e) (clicks, drags) grid coordinates
        const rect = this.canvas.getBoundingClientRect();   //returns a DOMRect object based on the css bounding boxes
        return {
            // returns converted pixel -> grid coordinates
            // e.clientX and e.clientY give the 
            // horizontal (x) and vertical (y) position of the mouse pointer,
            // in pixels, relative to the top-left corner of the
            // browser’s visible area (the viewport) when the event occurred.
            x: Math.floor((e.clientX - rect.left) / this.gridSize),
            y: Math.floor((e.clientY - rect.top) / this.gridSize)
        };
    }

    handleMouseDown(e) {  //manages user placing the start node, end node, obstacles
        if (this.isRunning) return;

        const pos = this.getMousePos(e);
        // exit if position out of bounds
        if (pos.x < 0 || pos.x >= this.cols || pos.y < 0 || pos.y >= this.rows) return;

        const node = this.grid[pos.x][pos.y];

        if (this.isPlacingStart) {  //start node not set
            //reset any existing start/end nodes
            this.clearStartEnd();
            //make that node the start
            node.isStart = true;
            //update reference
            this.start = node;
            //next user action will place the end node
            this.isPlacingStart = false;
            //center green particle burst in middle of cell
            this.addParticles(pos.x * this.gridSize + this.gridSize / 2, pos.y * this.gridSize + this.gridSize / 2, '#00ff00');
        } else if (!this.start || (this.start && !this.end)) {  //start node set, end node not set
            //check that it isnt on start 
            if (!node.isStart) {
                //make that node the end
                node.isEnd = true;
                //update reference
                this.end = node;
                //trigger red particle burst
                this.addParticles(pos.x * this.gridSize + this.gridSize / 2, pos.y * this.gridSize + this.gridSize / 2, '#ff0000');
            }
        } else {                    //mousedown event triggers an obstacle placement
            if (!node.isStart && !node.isEnd) {  //start and end nodes set
                //allow for true/false status for obstacles
                node.isObstacle = !node.isObstacle;
                //start drawing obstacles on drag
                this.isDrawingObstacles = true;
            }
        }
    }

    handleMouseMove(e) {  //draw obstacles on drag
        //at least one needs to be true, and the function returns early.
        if (!this.isDrawingObstacles || this.isRunning) return;

        //if we are here we are in drawing mode and not running algorithm
        const pos = this.getMousePos(e);  //returns grid coordinates
        if (pos.x < 0 || pos.x >= this.cols || pos.y < 0 || pos.y >= this.rows) return;

        //pos holds grid coordinates from mouse move event
        const node = this.grid[pos.x][pos.y];
        //set obstacle if not start/end
        if (!node.isStart && !node.isEnd) {
            node.isObstacle = true;
        }
    }

    clearStartEnd() {  //resets the grid state for start and end points
        //remove the start and end status on the nodes
        if (this.start) this.start.isStart = false;
        if (this.end) this.end.isEnd = false;
        //removes the references
        this.start = null;
        this.end = null;
        //next user action will select a new start node
        this.isPlacingStart = true;
    }

    clearPath() {
        this.openSet = [];
        this.closedSet = [];
        this.path = [];
        // zero out f, parent, and properties for all nodes
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                node.f = 0;
                node.g = 0;
                node.h = 0;
                node.parent = null;
                node.isPath = false;
                node.isExplored = false;
                node.isFrontier = false;
            }
        }
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
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
    }

    generateRandomObstacles() {
        this.clearPath();
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                //each node has a 30% chance of becoming an obstacle
                if (!node.isStart && !node.isEnd && Math.random() < 0.3) {
                    //set the node's property to be an obstacle
                    node.isObstacle = true;
                }
            }
        }
    }

    toggleAnimation() { 
        this.animationEnabled = !this.animationEnabled;
        //retrieves element with the ID 'animateBtn' from the DOM.
        const btn = document.getElementById('animateBtn');
        //changes button text based on current state
        btn.textContent = this.animationEnabled ? 'Disable Animation' : 'Enable Animation';
    }

    addParticles(x, y, color, count = 10) {  //add colored particles at x,y
        for (let i = 0; i < count; i++) {
            //push() adds new particle to the end of the particles array
            this.particles.push(new Particle(x, y, color));
        }
    }

    heuristic(a, b) { //distance formula for a*
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    getNeighbors(node) {  //returns non-obstacle neighbors of a node
        const neighbors = [];
        const x = node.x;
        const y = node.y;

        // 4 possible directions (left, right, down, up)
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];
        // calculate neighboring cell positions
        directions.forEach(dir => {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows) {
                //give neighbor a grid point
                const neighbor = this.grid[newX][newY];
                if (!neighbor.isObstacle) {
                    //add non-obstacle neighbors to the end of the neighbors array
                    neighbors.push(neighbor);
                }
            }
        });
        //we need to return valid neighbors for a* to pathfind correctly
        return neighbors;
    }

    reconstructPath(current) {   //retrace steps from end to start using parent links
        this.path = [];
        while (current) {
            //going backwards and adding each node to the start of the array 
            // will generate a path from start to end
            this.path.unshift(current);
            current = current.parent;
        }

        // between start and end, set nodes as part of path
        this.path.forEach((node, index) => {
            if (!node.isStart && !node.isEnd) {
                node.isPath = true;

                // Visual: Add particles along the path with a 50ms linear delay scaled by index
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

    async startPathfinding() {  //main a* algorithm -- open set means nodes to be evaluated, closed set means nodes already evaluated
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
            this.openSet.splice(currentIndex, 1);  //remove 1 item at currentIndex
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
            if (current === this.end) {  //truthy if ref's to nodes in memory are the same
                //return a path array from start to end
                this.reconstructPath(current);  
                this.isRunning = false;
                //reenable start button
                document.getElementById('startBtn').disabled = false;
                return;
            }

            // Check all neighbors
            const neighbors = this.getNeighbors(current);

            //skip over neighbors already evaluated
            for (const neighbor of neighbors) {
                if (this.closedSet.includes(neighbor)) continue;

                // cost in a grid is always 1 between nodes
                const tentativeG = current.g + 1;

                //create the frontier nodes based on neighbors
                if (!this.openSet.includes(neighbor)) {
                    this.openSet.push(neighbor);
                    neighbor.isFrontier = true;
                    // Add frontier particles
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
        //stop running
        this.isRunning = false;
        //reenable start button
        document.getElementById('startBtn').disabled = false;
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

        // Draw nodes
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const node = this.grid[i][j];
                const x = i * this.gridSize;
                const y = j * this.gridSize;

                if (node.isObstacle) {
                    this.ctx.fillStyle = '#333';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isStart) {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isEnd) {
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isPath) {
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isExplored) {
                    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (node.isFrontier) {
                    this.ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                }
            }
        }

        // Draw particles
        this.particles = this.particles.filter(particle => {
            particle.update(); 
            particle.draw(this.ctx);
            return particle.life > 0;
        });
    }

    animate() {
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    debugger;
    new AStarVisualizer();
});
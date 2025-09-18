// --- Yuka NavMesh and PathPlanner Setup ---
// Convert polygons to Yuka navmesh format
const navMesh = new YUKA.NavMesh();
// For a real navmesh, you would load or generate polygons and their adjacency
// Here, we use a simple example with two adjacent squares
navMesh.fromPolygons(polygons.map(poly => poly.map(v => new YUKA.Vector3(v.x, v.y, 0))));

const pathPlanner = new YUKA.PathPlanner(navMesh);

// Find a path between two points using Yuka
function findNavMeshPath(start, end) {
    // start and end should be YUKA.Vector3
    const path = pathPlanner.findPath(start, end);
    // path is an array of YUKA.Vector3
    return path;
}

// Example usage:
// const start = new YUKA.Vector3(150, 150, 0);
// const end = new YUKA.Vector3(450, 250, 0);
// const navPath = findNavMeshPath(start, end);
// Use navPath for visualization and funnel smoothing
// --- NavMesh Polygon Visualization Starter ---
// Example polygon data (replace with your own navmesh polygons)
const polygons = [
    [ {x: 100, y: 100}, {x: 300, y: 100}, {x: 300, y: 300}, {x: 100, y: 300} ], // Square
    [ {x: 300, y: 100}, {x: 500, y: 100}, {x: 500, y: 300}, {x: 300, y: 300} ], // Adjacent square
];

// Draw polygons on canvas
function drawPolygons(ctx, polygons) {
    ctx.save();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    polygons.forEach(poly => {
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,200,255,0.1)';
        ctx.fill();
    });
    ctx.restore();
}

// Example usage in your animation loop:
// Replace grid drawing with polygon drawing
// function animate() {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     drawPolygons(ctx, polygons);
//     // ...draw path, particles, etc.
//     requestAnimationFrame(animate);
// }

// --- Yuka NavMesh Setup Starter ---
// You can use Yuka.NavMesh and Yuka.PathPlanner for pathfinding
// See Yuka documentation for details: https://mugen87.github.io/yuka/docs/navmesh.html
// script.js - Navmesh Pathfinding Visualizer with Yuka
// Refactored to use Yuka for navmesh and funnel algorithm
import * as YUKA from 'yuka';

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

    handleMouseDown(e) {
        if (this.isRunning) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Select start/end points inside polygons
        if (this.isPlacingStart) {
            this.clearStartEnd();
            this.start = new YUKA.Vector3(x, y, 0);
            this.isPlacingStart = false;
            this.addParticles(x, y, '#00ff00');
        } else if (!this.start || (this.start && !this.end)) {
            this.end = new YUKA.Vector3(x, y, 0);
            this.addParticles(x, y, '#ff0000');
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

    async startPathfinding() {
        if (!this.start || !this.end) {
            alert('Please place both start and end points');
            return;
        }
        this.clearPath();
        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        // Find navmesh path and apply funnel smoothing
        const navPath = findNavMeshPath(this.start, this.end);
        if (!navPath || navPath.length === 0) {
            alert('No path found!');
            this.isRunning = false;
            document.getElementById('startBtn').disabled = false;
            return;
        }
        // Visualize the smoothed path
        for (let i = 0; i < navPath.length; i++) {
            const p = navPath[i];
            setTimeout(() => {
                this.addParticles(p.x, p.y, '#ffff00', 5);
                this.ctx.save();
                this.ctx.fillStyle = '#ffff00';
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }, i * 50);
        }
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw polygons (navmesh)
        drawPolygons(this.ctx, polygons);
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
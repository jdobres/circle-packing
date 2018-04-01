clog = console.log
let obj = []
let qt
let button
let old_width
let frameCounter = 0
let doToggleGrid = false
let oldSliderVal = 0
let sliderSize

function setup() {
	let w = document.getElementById("sketch-holder").offsetWidth
	let h = document.getElementById("sketch-holder").offsetHeight
	old_width = w
	
	let cnv = createCanvas(w, h)
	cnv.parent("sketch-holder")
	
	
	let controls = createDiv('')
	controls.parent('#sketch-holder')
	
	let btnReload = createA('#', 'reload')
	btnReload.mousePressed(set_sketch)
	btnReload.parent(controls)
	
	let btnToggleGrid = createA('#', 'toggle quadtree')
	btnToggleGrid.mousePressed(toggle_grid)
	btnToggleGrid.parent(controls)
	
	sliderSize = createSlider(10, 100, 50)
	sliderSize.parent(controls)
	sliderSize.elt.addEventListener("input", set_sketch)
	oldSliderVal = sliderSize.value()
	
	let divText = createDiv('slide to change max size')
	divText.parent(controls)
	
	set_sketch()
}

function draw() {
	++frameCounter
	
	for (let i = 0; i < 7; ++i) {
		qt.add_new_circle()
	}
	
	QuadForest.drawCircles()
	
	if (doToggleGrid) {
		qt.draw(color('red'))
	}			
}

function set_sketch() {
	
	frameCounter = 0
	obj = []
	qt = QuadForest.setup()
	background(0)
	strokeWeight(1)
	loop()
}

function toggle_grid() {
	doToggleGrid = !doToggleGrid
	set_sketch()
}

function windowResized() {
	
	var w = document.getElementById("sketch-holder").offsetWidth
	var h = document.getElementById("sketch-holder").offsetHeight
	
	if (w == old_width) {
		return
	}
	
	resizeCanvas(w, h)
	
	set_sketch()
}

class QuadForest {
	
	static setup() {
		rectMode(CORNERS)
		frameRate(30)
		return new QuadForest([0, 0, width, height], sliderSize.value())
	}
	
	static calculate_tree_sizes(max_radius) {
		
		let max_radii = [max_radius]
		let length = floor(Math.log2(max_radius))
		for (let i = 0; i < length; ++i) {
			max_radii.push(max_radii[max_radii.length - 1] / 2)
		}
		return(max_radii)
	}
	
	constructor(bounds, max_radius) {
		
		this.max_radius = max_radius
		this.radius = max_radius
		this.max_tries = 2000
		
		let max_radii = QuadForest.calculate_tree_sizes(max_radius)
		this.trees = []
		for (let r of max_radii) {
			this.trees.push(new QuadTree(bounds, r))
		}
		this.tree_index = 0
	}
	
	draw(the_color) {
		for (let t of this.trees) {
			t.draw(the_color)
		}
	}
	
	collision_check(new_circle) {
		
		// if it returns TRUE, we have a collision and the circle is not valid
		
		for (let f of this.trees) {
			
			let max_bounds = QuadTree.max_bounds_for_circle(new_circle, f.max_radius)
			if (f.check_circle_placement(new_circle, max_bounds)) {
				return true
			}
		}
		
		return(false)
	}
	
	update_tree_index(new_radius) {
		
		if (new_radius < this.trees[this.tree_index].min_radius && this.tree_index < this.trees.length - 1) {
			++this.tree_index
		}
	}
	
	insert_object(new_object) {
		this.trees[this.tree_index].insertObject(new_object)
	}
	
	add_new_circle() {
		
		if (obj.length >= 4000 || frameCounter >= 30 * 60) {
			noLoop()
		}
		
		for (let i = 0; i < this.max_tries; ++i) {
			
			let new_circle = {x: random(width), y: random(height), radius: this.radius, startFrame: frameCount, lastSize: 0}
			
			if (!this.collision_check(new_circle)) {
				this.insert_object(new_circle)
				obj.push(new_circle)
				return
			}		
		}
		
		this.radius *= 0.99
		this.radius = this.radius < 0.5 ? 0.5 : this.radius
		this.update_tree_index(this.radius)
	}
	
	static drawCircles() {
		
		
		for (let i = obj.length - 1; i >= 0; --i) {
			let c = obj[i]
			
			if (c.lastSize >= 1) {
				break
			} 
			
			let s = (frameCount - c.startFrame) / 5
			s = constrain(s, 0, 1)
			
			if (s > 0) {
				strokeWeight(1)
				stroke(255)
				fill(0, 0)
					
				ellipse(c.x, c.y, c.radius * 2 * s)
				c.lastSize = s
			}
		}
	}
}

class QuadTree {

	static max_bounds_for_circle(the_circle, max_radius) {
				
		let extent = max_radius + the_circle.radius
		
		let x0 = the_circle.x - extent,
		    x1 = the_circle.x + extent,
		    y0 = the_circle.y - extent,
		    y1 = the_circle.y + extent
		    
		return([x0, y0, x1, y1])
		
	}
	
	constructor(bounds, max_radius) {
		
		this.bounds = bounds // bounds = [x0, y0, x1, y1]
		this.kids = []
		this.obj = null
		
		// specific to circle packing
		this.max_radius = max_radius
		this.min_radius = max_radius / 2
		this.radius = this.max_radius
	}
	
	insertObject(obj) {
				
		if (this.obj) {
			// if this cell has an object, split the cell into a new sub-quad
			let temp_obj = this.obj
			this.obj = null
			this.split()
			this.insertObject(temp_obj)
			this.insertObject(obj)
		} else if (!this.obj && this.isLeaf) {
			this.obj = obj
		} else {
			// find correct leaf in empty quad
			for (let k of this.kids) {
				if (k.hitTest(obj.x, obj.y)) {
					k.insertObject(obj)
					return
				}
			}
		}
	}
	
	split() {
				
		let x0 = this.bounds[0], x1 = this.bounds[2], y0 = this.bounds[1], y1 = this.bounds[3]
		let x_c = (x0 + x1) / 2
		let y_c = (y0 + y1) / 2
		
		this.kids.push(new QuadTree([x0, y0, x_c, y_c]))
		this.kids.push(new QuadTree([x_c, y0, x1, y_c]))
		this.kids.push(new QuadTree([x0, y_c, x_c, y1]))
		this.kids.push(new QuadTree([x_c, y_c, x1, y1]))		
	}
	
	hitTest(x, y) {
		if (x < this.bounds[0]) { return false }
		if (x >= this.bounds[2]) { return false }
		if (y < this.bounds[1]) { return false }
		if (y >= this.bounds[3]) { return false }
		return(true)
	}
	
	intersectsRect(other_rect) {
				
	  	let does_intersect = !(other_rect[0] > this.bounds[2] || 
	  		other_rect[2] < this.bounds[0] || 
	  		other_rect[1] > this.bounds[3] ||
	  		other_rect[3] < this.bounds[1])
	  		
		return(does_intersect)
	}
	
	
	
	check_circle_placement(the_circle, maximum_bounds) {
		
		// If there is a leaf with no object, there can be no collision: return false
		// check if maximim_bounds intersects this quad
		// - if no, return false
		// - if yes and isLeaf and has object, test circle and return overlap result (true for overlap, false for safe)
		// - if yes and not leaf, recurse through descendants
		
		// if return value is ever true, break immediately and return, ending search
		
		if (this.isLeaf && !this.obj) {
			return false
		} 
		
		if (!this.intersectsRect(maximum_bounds)) {
			return false
		}
		
		if (this.isLeaf && this.obj) {
			return dist(this.obj.x, this.obj.y, the_circle.x, the_circle.y) < this.obj.radius + the_circle.radius + 1
		} 
		
		if (!this.isLeaf) {
			for (let k of this.kids) {
				if (k.check_circle_placement(the_circle, maximum_bounds)) {
					return true
				}
			}
		}
		
		return false
	}
	
	draw(the_color) {
		
		fill(0, 0)
		strokeWeight(0.5)
		stroke(the_color)
		rect(...this.bounds)
		
		for (let k of this.kids) {
			k.draw(the_color)
		}
	}
	
	get isLeaf() {
		return this.kids.length == 0
	}	
}
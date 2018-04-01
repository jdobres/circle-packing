clog = console.log
let qf, linear
let frameCounter = 0
let oldSliderVal = 0
let sliderSize, qf_iterator, linear_iterator, qf_text, linear_text

function setup() {
	let w = document.getElementById("sketch-holder").offsetWidth
	let h = document.getElementById("sketch-holder").offsetHeight
	old_width = w
	
	let cnv = createCanvas(w, h)
	cnv.parent("sketch-holder")
	
	let controls = createDiv('')
	controls.parent('#sketch-holder')
	
	sliderSize = createSlider(3, 50, 20)
	sliderSize.parent(controls)
	sliderSize.elt.addEventListener("input", set_sketch)
	oldSliderVal = sliderSize.value()
	
	let divText = createDiv('slide to change max size')
	divText.parent(controls)
	
	qf_text = createDiv('QuadTree: 0')
	qf_text.style('color', '#79bfc6')
	qf_text.parent(controls)
	linear_text = createDiv('Naive: 0')
	linear_text.style('color', '#e5bea0')
	linear_text.parent(controls)
	
	set_sketch()
}

function draw() {
	++frameCounter
	
	linear_iterator.next()
	qf_iterator.next()
	
	qf_text.html('QuadTree: ' + qf.total_members)
	linear_text.html('Naive: ' + linear.obj.length)
}

function set_sketch() {
	
	frameCounter = 0
	qf = QuadForest.setup()
	qf_iterator = qf.run()
	
	linear = new LinearCirclePack(sliderSize.value())
	linear_iterator = linear.run()
	
	background('#79bfc6')
	fill('#e5bea0')
	strokeWeight(0)
	rect(width/2, 0, width, height)
	strokeWeight(1)
	loop()
}

class LinearCirclePack {
	
	*run() {
		while (this.obj.length <= 2000) {
			let start_time = millis()
			while (millis() - start_time <= 1) {
				this.add_new_circle()
			}
			yield
		}
	}
	
	constructor(max_radius) {
		
		this.max_radius = max_radius
		this.radius = max_radius
		this.max_tries = 2000
		this.obj = []
	}
	
	add_new_circle() {
		
		for (let i = 0; i < this.max_tries; ++i) {
			let good = true
			let new_circle = {x: random(width / 2 + this.max_radius, width), y: random(height), radius: this.radius}
			
			for (let o of this.obj) {
				if (dist(new_circle.x, new_circle.y, o.x, o.y) < new_circle.radius + o.radius + 1) {
					good = false
					break
				}
			}
			
			if (good) {
				this.obj.push(new_circle)
				
				strokeWeight(1)
				stroke(255)
				fill(0, 0)
				ellipse(new_circle.x, new_circle.y, new_circle.radius * 2)
				
				return
			} 
		}
		
		this.radius *= 0.99
		this.radius = this.radius < 0.5 ? 0.5 : this.radius
	}
	
}

class QuadForest {
	
	*run() {
		while (this.total_members <= 2000) {
			let start_time = millis()
			while (millis() - start_time <= 1) {
				this.add_new_circle()
			}
			yield
		}
	}
	
	static setup() {
		rectMode(CORNERS)
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
		this.total_members = 0
		
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
		
		// Circles are created in order of decreasing size.
		// Once we move down to a tree with a smaller max circle size, we'll never move back up.
		// This updates the index of the currently active tree.
		
		if (new_radius < this.trees[this.tree_index].min_radius && this.tree_index < this.trees.length - 1) {
			++this.tree_index
		}
	}
	
	insert_object(new_object) {
		this.trees[this.tree_index].insertObject(new_object)
	}
	
	add_new_circle() {
		
		if (this.total_members >= 4000 || frameCounter >= 30 * 60) {
			noLoop()
		}
		
		for (let i = 0; i < this.max_tries; ++i) {
			
			let new_circle = {x: random(width / 2 - this.max_radius), y: random(height), radius: this.radius, startFrame: frameCount, lastSize: 0}
			
			if (!this.collision_check(new_circle)) {
				this.insert_object(new_circle)
				this.total_members++
				
				
				// draw the circle
				strokeWeight(1)
				stroke(255)
				fill(0, 0)
				ellipse(new_circle.x, new_circle.y, new_circle.radius * 2)
				return
			}		
		}
		
		this.radius *= 0.99
		this.radius = this.radius < 0.5 ? 0.5 : this.radius
		this.update_tree_index(this.radius)
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
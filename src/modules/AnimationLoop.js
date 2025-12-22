class AnimationLoop {
  constructor(controls, water, boat, postProcessing) {
    this.controls = controls;
    this.water = water;
    this.boat = boat;
    this.postProcessing = postProcessing;
    this.animate = this.animate.bind(this); // Bind 'this' to the animate function
  }

  animate() {
    requestAnimationFrame(this.animate);
    const time = performance.now() * 0.001;

    this.water.update();
    this.boat.update(time);

    this.controls.update();
    this.postProcessing.render();
  }
}

export { AnimationLoop };

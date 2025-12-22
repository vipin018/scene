import gsap from "gsap";

class LoadingAnimation {
  constructor(loadingScreen, loadingLine) { // Removed loadingBoatContainer
    this.loadingScreen = loadingScreen;
    this.loadingLine = loadingLine;

    this.timeline = gsap.timeline({ paused: true });
    this.setupAnimation();
  }

  setupAnimation() {
    gsap.set(this.loadingScreen, { opacity: 1, pointerEvents: "all" });
    gsap.set(this.loadingLine, { width: "0%" });

    // Simple line pulsing animation
    this.timeline.to(this.loadingLine, {
      opacity: 0.7,
      duration: 0.5,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    });
  }

  startLoading() {
    this.timeline.play();
  }

  updateProgress(progress) {
    // Update the width of the loading line based on progress
    gsap.to(this.loadingLine, {
        width: `${progress * 100}%`,
        duration: 0.5,
        ease: "power1.out"
    });
  }

  completeLoading() {
    this.timeline.pause();

    gsap.to(this.loadingScreen, {
      opacity: 0,
      pointerEvents: "none",
      duration: 1,
      delay: 0.5,
      onComplete: () => {
        this.loadingScreen.style.display = "none";
      }
    });

    // Fade out the loading line
    gsap.to(this.loadingLine, {
        opacity: 0,
        duration: 0.5
    }, "<");
  }
}

export { LoadingAnimation };
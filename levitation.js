// Distinguish quick jump taps from an intentional hold on touch or keyboard.
export class JumpHold {
 constructor(){this.cancel();}
 press(now){if(this.down)return;this.down=true;this.started=now;this.used=false;}
 update(now){if(this.down&&now-this.started>=260)this.used=true;return this.down&&this.used;}
 release(now){if(!this.down)return false;this.update(now);const tap=!this.used;this.cancel();return tap;}
 cancel(){this.down=false;this.started=0;this.used=false;}
}

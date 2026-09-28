import './compat.js';
import { createWechatPlatform } from './platform.js';
import { CanvasApp } from './canvas-app.js';

new CanvasApp(createWechatPlatform(wx, requestAnimationFrame, cancelAnimationFrame));

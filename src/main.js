import './styles/main.css';
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';

const manager = new THREE.LoadingManager();
manager.progress = 0;

const scene = new SceneManager(document.querySelector('#webgl'));
const loader=document.querySelector('#loader'),bar=document.querySelector('#loader-bar'),value=document.querySelector('#loader-value');
const start=performance.now();
function load(now){manager.progress=Math.min(100,Math.round((now-start)/2.5));bar.style.transform=`scaleX(${manager.progress/100})`;value.textContent=`${manager.progress} — 100%`;if(manager.progress<100)requestAnimationFrame(load);else{loader.classList.add('done');document.body.classList.add('ready');}}
if(new URLSearchParams(location.search).has('preview')){manager.progress=100;loader.remove();document.body.classList.add('ready');}
else requestAnimationFrame(load);

window.__fluidLab=scene;

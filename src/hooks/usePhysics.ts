import { useRef, useCallback, useEffect } from 'react';
import Matter from 'matter-js';
import type { Task } from '../types';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BLOCK_WIDTH,
  GROUND_Y,
  GROUND_THICKNESS,
  WALL_THICKNESS,
  hoursToHeight,
} from '../utils/constants';

export interface PhysicsAPI {
  engine: Matter.Engine;
  addBlock: (task: Task) => Matter.Body;
  removeBlock: (taskId: string) => void;
  setStatic: (taskId: string, isStatic: boolean) => void;
  getBodyPositions: () => Map<string, { x: number; y: number; angle: number }>;
  mouseDown: (x: number, y: number) => void;
  mouseMove: (x: number, y: number) => void;
  mouseUp: () => void;
}

export function usePhysics(): PhysicsAPI {
  const engineRef = useRef<Matter.Engine>(null!);
  const bodiesRef = useRef<Map<string, Matter.Body>>(new Map());
  const mouseConstraintRef = useRef<Matter.Constraint | null>(null);
  const dragBodyRef = useRef<Matter.Body | null>(null);

  if (!engineRef.current) {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2, scale: 0.001 },
    });

    // Ground
    const ground = Matter.Bodies.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + GROUND_THICKNESS / 2,
      WORLD_WIDTH + 100,
      GROUND_THICKNESS,
      { isStatic: true, friction: 0.8, restitution: 0.1, label: 'ground' }
    );

    // Walls
    const leftWall = Matter.Bodies.rectangle(
      -WALL_THICKNESS / 2,
      WORLD_HEIGHT / 2,
      WALL_THICKNESS,
      WORLD_HEIGHT * 2,
      { isStatic: true, friction: 0.3, label: 'wall-left' }
    );
    const rightWall = Matter.Bodies.rectangle(
      WORLD_WIDTH + WALL_THICKNESS / 2,
      WORLD_HEIGHT / 2,
      WALL_THICKNESS,
      WORLD_HEIGHT * 2,
      { isStatic: true, friction: 0.3, label: 'wall-right' }
    );

    Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);
    engineRef.current = engine;
  }

  // Run physics at 60fps
  useEffect(() => {
    const engine = engineRef.current;
    let raf: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const delta = Math.min(time - lastTime, 32); // cap at ~30fps min
      lastTime = time;
      Matter.Engine.update(engine, delta);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, []);

  const addBlock = useCallback((task: Task): Matter.Body => {
    const h = hoursToHeight(task.hours);
    const body = Matter.Bodies.rectangle(task.x, task.y, BLOCK_WIDTH, h, {
      friction: 0.6,
      frictionStatic: 0.8,
      restitution: 0.05,
      density: 0.002,
      chamfer: { radius: 6 },
      label: task.id,
      isStatic: task.completed,
      angle: task.angle || 0,
    });
    Matter.Composite.add(engineRef.current.world, body);
    bodiesRef.current.set(task.id, body);
    return body;
  }, []);

  const removeBlock = useCallback((taskId: string) => {
    const body = bodiesRef.current.get(taskId);
    if (body) {
      Matter.Composite.remove(engineRef.current.world, body);
      bodiesRef.current.delete(taskId);
    }
  }, []);

  const setStatic = useCallback((taskId: string, isStatic: boolean) => {
    const body = bodiesRef.current.get(taskId);
    if (body) {
      Matter.Body.setStatic(body, isStatic);
    }
  }, []);

  const getBodyPositions = useCallback(() => {
    const positions = new Map<string, { x: number; y: number; angle: number }>();
    bodiesRef.current.forEach((body, id) => {
      positions.set(id, {
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
      });
    });
    return positions;
  }, []);

  const mouseDown = useCallback((x: number, y: number) => {
    const engine = engineRef.current;
    const bodies = Matter.Composite.allBodies(engine.world);
    const point = { x, y };

    for (const body of bodies) {
      if (body.isStatic && body.label !== 'ground' && !body.label?.startsWith('wall')) {
        // completed blocks can't be dragged
        if (Matter.Bounds.contains(body.bounds, point)) {
          return; // it's a completed (gold) block — skip
        }
      }
      if (!body.isStatic && Matter.Bounds.contains(body.bounds, point)) {
        dragBodyRef.current = body;
        const constraint = Matter.Constraint.create({
          pointA: point,
          bodyB: body,
          pointB: { x: x - body.position.x, y: y - body.position.y },
          stiffness: 0.7,
          damping: 0.3,
          length: 0,
        });
        mouseConstraintRef.current = constraint;
        Matter.Composite.add(engine.world, constraint);
        break;
      }
    }
  }, []);

  const mouseMove = useCallback((x: number, y: number) => {
    if (mouseConstraintRef.current) {
      (mouseConstraintRef.current.pointA as Matter.Vector).x = x;
      (mouseConstraintRef.current.pointA as Matter.Vector).y = y;
    }
  }, []);

  const mouseUp = useCallback(() => {
    if (mouseConstraintRef.current) {
      Matter.Composite.remove(engineRef.current.world, mouseConstraintRef.current);
      mouseConstraintRef.current = null;
      dragBodyRef.current = null;
    }
  }, []);

  return {
    engine: engineRef.current,
    addBlock,
    removeBlock,
    setStatic,
    getBodyPositions,
    mouseDown,
    mouseMove,
    mouseUp,
  };
}

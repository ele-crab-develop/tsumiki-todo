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
  addBlock: (task: Task) => void;
  removeBlock: (taskId: string) => void;
  setStatic: (taskId: string, isStatic: boolean) => void;
  getBodyPositions: () => Map<string, { x: number; y: number }>;
  queryPoint: (x: number, y: number) => string | null;
  mouseDown: (x: number, y: number) => void;
  mouseMove: (x: number, y: number) => void;
  mouseUp: () => void;
}

const INFRA_LABELS = new Set(['ground', 'wall-left', 'wall-right']);

export function usePhysics(): PhysicsAPI {
  const engineRef = useRef<Matter.Engine>(null!);
  const bodiesRef = useRef<Map<string, Matter.Body>>(new Map());
  const constraintRef = useRef<Matter.Constraint | null>(null);

  if (!engineRef.current) {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2, scale: 0.001 },
    });

    const ground = Matter.Bodies.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + GROUND_THICKNESS / 2,
      WORLD_WIDTH + 100,
      GROUND_THICKNESS,
      { isStatic: true, friction: 0.8, restitution: 0.1, label: 'ground' }
    );

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

  useEffect(() => {
    const engine = engineRef.current;
    let raf: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const delta = Math.min(time - lastTime, 32);
      lastTime = time;
      Matter.Engine.update(engine, delta);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const addBlock = useCallback((task: Task): void => {
    const h = hoursToHeight(task.hours);
    const body = Matter.Bodies.rectangle(task.x, task.y, BLOCK_WIDTH, h, {
      friction: 0.6,
      frictionStatic: 0.8,
      restitution: 0.05,
      density: 0.002,
      label: task.id,
      isStatic: task.completed,
      // No chamfer — keeps physics rect identical to visual rect for accurate hit detection
      // Lock rotation so blocks stay upright
      inertia: Infinity,
      inverseInertia: 0,
    });
    Matter.Composite.add(engineRef.current.world, body);
    bodiesRef.current.set(task.id, body);
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
      if (!isStatic) {
        body.inertia = Infinity;
        body.inverseInertia = 0;
      }
    }
  }, []);

  const getBodyPositions = useCallback(() => {
    const positions = new Map<string, { x: number; y: number }>();
    bodiesRef.current.forEach((body, id) => {
      positions.set(id, { x: body.position.x, y: body.position.y });
    });
    return positions;
  }, []);

  const queryPoint = useCallback((x: number, y: number): string | null => {
    const allBodies = Matter.Composite.allBodies(engineRef.current.world);
    const hits = Matter.Query.point(allBodies, { x, y });
    for (const body of hits) {
      if (!INFRA_LABELS.has(body.label ?? '')) return body.label;
    }
    return null;
  }, []);

  const mouseDown = useCallback((x: number, y: number) => {
    const allBodies = Matter.Composite.allBodies(engineRef.current.world);
    const hits = Matter.Query.point(allBodies, { x, y });

    for (const body of hits) {
      if (INFRA_LABELS.has(body.label ?? '')) continue;
      if (body.isStatic) return; // completed — don't drag

      const c = Matter.Constraint.create({
        pointA: { x, y },
        bodyB: body,
        pointB: { x: x - body.position.x, y: y - body.position.y },
        stiffness: 0.7,
        damping: 0.3,
        length: 0,
      });
      constraintRef.current = c;
      Matter.Composite.add(engineRef.current.world, c);
      break;
    }
  }, []);

  const mouseMove = useCallback((x: number, y: number) => {
    if (constraintRef.current) {
      (constraintRef.current.pointA as Matter.Vector).x = x;
      (constraintRef.current.pointA as Matter.Vector).y = y;
    }
  }, []);

  const mouseUp = useCallback(() => {
    if (constraintRef.current) {
      Matter.Composite.remove(engineRef.current.world, constraintRef.current);
      constraintRef.current = null;
    }
  }, []);

  return {
    addBlock,
    removeBlock,
    setStatic,
    getBodyPositions,
    queryPoint,
    mouseDown,
    mouseMove,
    mouseUp,
  };
}

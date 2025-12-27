import { Field, DiagramNode, DiagramEdge } from './diagram';

export type EventType =
    | 'NODE_ADDED' | 'NODE_UPDATED' | 'NODE_MOVED' | 'NODE_DELETED'
    | 'EDGE_ADDED' | 'EDGE_DELETED'
    | 'FIELD_ADDED' | 'FIELD_UPDATED' | 'FIELD_DELETED';

export interface BaseEvent {
    type: EventType;
    projectId: string; // The Room ID
    actorId: string;   // Who made the change
    timestamp: number;
}

// --- Node Events ---

export interface NodeAddedEvent extends BaseEvent {
    type: 'NODE_ADDED';
    node: DiagramNode;
}

export interface NodeUpdatedEvent extends BaseEvent {
    type: 'NODE_UPDATED';
    nodeId: string;
    changes: {
        label?: string;
        // other node-level props
    };
}

export interface NodeMovedEvent extends BaseEvent {
    type: 'NODE_MOVED';
    nodeId: string;
    position: { x: number; y: number };
}

export interface NodeDeletedEvent extends BaseEvent {
    type: 'NODE_DELETED';
    nodeId: string;
}

// --- Field Events ---

export interface FieldAddedEvent extends BaseEvent {
    type: 'FIELD_ADDED';
    nodeId: string;
    field: Field;
}

export interface FieldUpdatedEvent extends BaseEvent {
    type: 'FIELD_UPDATED';
    nodeId: string;
    fieldId: string;
    changes: Partial<Field>;
}

export interface FieldDeletedEvent extends BaseEvent {
    type: 'FIELD_DELETED';
    nodeId: string;
    fieldId: string;
}

// --- Edge Events ---

export interface EdgeAddedEvent extends BaseEvent {
    type: 'EDGE_ADDED';
    edge: DiagramEdge;
}

export interface EdgeDeletedEvent extends BaseEvent {
    type: 'EDGE_DELETED';
    edgeId: string;
}

// --- Union ---
export type DiagramEvent =
    | NodeAddedEvent | NodeUpdatedEvent | NodeMovedEvent | NodeDeletedEvent
    | EdgeAddedEvent | EdgeDeletedEvent
    | FieldAddedEvent | FieldUpdatedEvent | FieldDeletedEvent;

export interface Field {
    id: string;
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isNullable?: boolean;
    isUnique?: boolean;
    defaultValue?: string;
}

export interface DiagramNodeData {
    label: string;
    fields: Field[];
}

export interface DiagramNode {
    id: string;
    type: 'mysqlTable' | 'mongoCollection';
    position: { x: number; y: number };
    data: DiagramNodeData;
}

export interface DiagramEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface DiagramContent {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
    metadata: {
        dbType: 'MYSQL' | 'MONGODB';
        version?: number;
    };
}

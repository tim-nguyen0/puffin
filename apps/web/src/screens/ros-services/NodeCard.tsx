export interface NodeCard {
    name: string;
    status: 'running' | 'armed' | 'stopped';
    type: string;
    description: string;
}


export function fetchPomPath(obj: any, path: string[]): any {
    let node = obj;
    for (const part of path) {
        if (!node || !Object.prototype.hasOwnProperty.call(node, part)) {
            throw new Error(`Path not found: ${path.join(' -> ')}`);
        }
        node = node[part];
    }
    return node;
}

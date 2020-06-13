import { Operation, Point, Editor } from '..';
/**
 * `PointRef` objects keep a specific point in a document synced over time as new
 * operations are applied to the editor. You can access their `current` property
 * at any time for the up-to-date point value.
 */
declare class PointRef {
    current: Point | null;
    private affinity;
    private editor;
    constructor(props: {
        point: Point | null;
        affinity: 'forward' | 'backward' | null;
        editor: Editor;
    });
    /**
     * Transform the point ref's current value by an operation.
     */
    transform(op: Operation): void;
    /**
     * Unreference the ref, allowing the editor to stop updating its value.
     */
    unref(): Point | null;
}
export { PointRef };
//# sourceMappingURL=point-ref.d.ts.map
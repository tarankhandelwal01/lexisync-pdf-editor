export type ChangeType = 'addition' | 'deletion';

export interface DiffRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Reads the fabric canvas JSON saved for a page and returns the bounding
 * boxes (in unzoomed/logical page units) of objects tagged with the given
 * changeType. Objects are tagged at creation time in useFabricCanvas/PageCanvas.
 */
export function getDiffRects(pageState: any, changeType: ChangeType): DiffRect[] {
  if (!pageState || !Array.isArray(pageState.objects)) return [];

  return pageState.objects
    .filter((obj: any) => obj.changeType === changeType)
    .map((obj: any) => ({
      left: obj.left || 0,
      top: obj.top || 0,
      width: (obj.width || 0) * (obj.scaleX || 1),
      height: (obj.height || 0) * (obj.scaleY || 1),
    }));
}

export function countDiffObjects(pageState: any, changeType: ChangeType): number {
  return getDiffRects(pageState, changeType).length;
}

/**
 * Returns the raw tagged fabric objects for a page (not just their bounding
 * boxes) so callers can read their id/type/text to build a change list.
 */
export function getChangeObjects(pageState: any, changeType: ChangeType): any[] {
  if (!pageState || !Array.isArray(pageState.objects)) return [];
  return pageState.objects.filter((obj: any) => obj.changeType === changeType);
}

/**
 * Human-readable label for a tracked change, built only from data the user
 * created in the editor (typed annotation text, shape type) — never from
 * parsing/extracting the original PDF's text content.
 */
export function describeChangeObject(obj: any): string {
  const id = typeof obj.id === 'string' ? obj.id : '';
  if (id.startsWith('cover-edited-item-')) return 'Original text covered';
  if (id.startsWith('edited-item-')) return obj.text ? `Replaced with "${obj.text}"` : 'Text replaced';
  if (obj.type === 'i-text' || obj.type === 'text') return obj.text ? `"${obj.text}"` : 'Text annotation';
  if (obj.type === 'rect') return obj.changeType === 'deletion' ? 'Redacted region' : 'Rectangle annotation';
  if (obj.type === 'path') return 'Drawing / highlight stroke';
  return 'Annotation change';
}

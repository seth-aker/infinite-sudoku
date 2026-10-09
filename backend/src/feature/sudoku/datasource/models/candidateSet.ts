export class CandidateSet extends Set<number> {
  constructor(values?: number[] | null) {
    super(values);
  }
  toJSON() {
    return [...this];
  }
}

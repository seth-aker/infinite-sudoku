import type { Cell } from "./cell";
import type { Difficulty } from "./difficulty";
import type { Row } from "./row";
import lodash from 'lodash'
export interface SudokuOptions {
  difficulty: Difficulty
}
export class SudokuPuzzle {
    readonly originalPuzzle: Array<Row>;
    readonly cellsPerRow: number;
    readonly options: SudokuOptions;
    rows: Array<Row>;
    constructor(rows: Array<Row>, options?: SudokuOptions);
    constructor(rows: Array<Row>, options: SudokuOptions, originalPuzzle: Row[])
    constructor(rows: Array<Row>, options: SudokuOptions = {difficulty: {rating: 'medium'}}, originalPuzzle?: Row[]) {
        if(!Number.isInteger(Math.sqrt(rows.length))) {
          throw new Error(`Row length of ${rows.length} is invalid for proper sudoku puzzles.`)
        }
        this.rows = rows,
        this.originalPuzzle = originalPuzzle ?? lodash.cloneDeep(rows)
        this.cellsPerRow = rows.length
        this.options = options;
    }
    /**
     * Takes a number (0 - 8 for standard sudoku) and returns the block of digits from that space.
     * 0 is the top left block, 8 is the bottom right block
     * @param num number
     * @returns Array<Cell> | undefined
     */
    getBlock(num: number) {
        if(num >= this.cellsPerRow || num < 0) {
          return undefined
        }
        const block = new Array<Cell>(this.cellsPerRow);
        const blockWidth = Math.sqrt(this.cellsPerRow); // this should be always an integer!!!
        const yStartIndex = num - (num % blockWidth)
        const xStartIndex = blockWidth * (num % blockWidth)
        for(let i = 0; i < this.cellsPerRow; i++) {
          block[i] = this.rows[yStartIndex + Math.floor(i / blockWidth)][xStartIndex + (i % blockWidth)]
        }
        return block
    }
    getColumn(num: number) {
      if(num >= this.cellsPerRow || num < 0) {
        return undefined
      }
      const column = new Array<Cell>(this.cellsPerRow);
      for(let i = 0; i < this.cellsPerRow; i++) {
        column[i] = this.rows[i][num]
      }
      return column;
    }
    /**
     *
     * @param y row number (top row = 0)
     * @param x column number (left column = 0)
     * @returns Cell
     */
    getCell(x: number | undefined, y: number | undefined) {
      if(x === undefined || y === undefined || x < 0 || x >= this.cellsPerRow || y < 0 || y >= this.cellsPerRow) {
        return undefined
      }
      return this.rows[y][x]
    }
        /**
     *
     * @param y row number (top row = 0)
     * @param x column number (left column = 0)
     * @returns void
     */
    setCell(cell: Cell, x: number, y: number) {
      if(x < 0 || x >= this.cellsPerRow || y < 0 || y >= this.cellsPerRow) {
        return
      }
      this.rows[y][x] = cell;
    }

    toJSON() {
      return {
        originalPuzzle: this.originalPuzzle,
        rows: this.rows,
        options: this.options
      }
    }
    static fromJSON(json: any): SudokuPuzzle {
      const instance = new SudokuPuzzle(json.rows, json.options, json.originalPuzzle);
      return instance
    }
}

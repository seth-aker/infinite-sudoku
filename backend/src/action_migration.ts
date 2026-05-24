import sql from './core/dataSource/postgres'
interface Cell {
  idx: number;
  value: number,
  candidates: number[]
}
interface Action {
  cell: Cell,
  isParent: boolean
}
async function migrate() {
  const res = await sql`
    SELECT * FROM user_puzzles
    WHERE actions IS NOT NULL AND cardinality(actions) > 0
  `
  res.forEach((row) => {
    const actionNms = row.actions.map(deserializeAction)
    const reserialized = actionNms.map(serializeAction)
    const res2 = sql`
      UPDATE user_puzzles 
      SET actions = ${reserialized}
      WHERE user_id = ${row.user_id} AND puzzle_id = ${row.puzzle_id}
    `.execute().catch((err) => {
      console.log(err)
    })
    res2.then((res) => {
      if(res) {
        if(res.count === 0) {
          console.log(`Puzzle id: ${row.puzzle_id} failed`)
        }
      }
    })
  })
  console.log("Migrate finished") 
}
function deserializeAction(actionNum: number) {
  const index = actionNum & 0b1111111 // for bits 0-7
  const cellValue = (actionNum >> 7) & 0b1111; // for bits 8-11
  let candidateMask = (actionNum >> 11) & 0b111111111; // for bits 12-20
  const isParent = (actionNum >> 22) & 1 // for bits 21-22

  const candidates: number[] = [];
  while(candidateMask != 0) {
    const candidate = ctz(candidateMask) + 1;
    candidateMask = candidateMask & (candidateMask - 1);
    candidates.push(candidate)
  }
  const cell: Cell = {
    idx: index,
    value: cellValue,
    candidates,
 }
 const action: Action = {
  isParent: isParent === 1 ? true : false,
  cell
 }
  return action;
}
function ctz(num: number) {
  if(num === 0) return 32;
  let count = 0;
  while((num & 1) === 0) {
    count++;
    num >>= 1
  }
  return count;
}
function serializeAction(action: Action) {
  const isParentBit = action.isParent ? 1 : 0;
  const candidateMask = action.cell.candidates.reduce((prev, cur) => {
    const mask = prev | (1 << (cur - 1))
    return mask;
  }, 0)
  const cellValue = action.cell.value || 0;

  // bitmask, 7 bits for cell index, 4 bits for cell value, 9 bits for candiates
  return (isParentBit << 20) | (candidateMask << 11 ) | (cellValue << 7) | (action.cell.idx)
}

migrate()

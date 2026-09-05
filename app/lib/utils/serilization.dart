import 'package:infinite_sudoku/domain/models/action.dart';
import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:infinite_sudoku/utils/ctz.dart';

class PuzzleSerializer {
  static List<Cell> deserializeCells(String cells, String? candidates) {
    final cellVals = cells
        .split('')
        .map((val) => int.tryParse(val) ?? -1)
        .toList();
    final cands = candidates
        ?.split(':')
        .map(
          (candidateStr) => candidateStr
              .split('')
              .map((val) => int.tryParse(val) ?? -1)
              .toList(),
        )
        .toList();
    return cellVals.indexed.map((each) {
      final idx = each.$1;
      final val = each.$2;
      return Cell(
        idx: idx,
        value: val,
        candidates: cands != null ? cands[idx].toSet() : {},
      );
    }).toList();
  }

  static Action deserializeAction(int action) {
    final index = action & 127; // 0b1111111
    final cellVal = (action >> 7) & 15; // 0b1111
    int candidateMask = (action >> 11) & 511; // 0b111111111
    final isParentBit = (action >> 20) & 1;

    Set<int> candidates = {};
    while (candidateMask != 0) {
      final candidate = ctz(candidateMask) + 1;
      candidates.add(candidate);
      candidateMask &= candidateMask - 1;
    }
    return Action(
      cell: Cell(idx: index, value: cellVal, candidates: candidates),
      isParent: isParentBit == 1,
    );
  }

  static ({String cells, String candidates}) serializeCells(List<Cell> cells) {
    String cellStr = '';
    String candidateStr = '';

    for (final cell in cells) {
      cellStr += cell.value.toString();
      candidateStr += '${cell.candidates.join('')}:';
    }
    return (
      cells: cellStr,
      candidates: candidateStr.substring(0, candidateStr.length - 1),
    );
  }

  static int serializeAction(Action action) {
    final isParentBit = action.isParent ? 1 : 0;
    final candidateMask = [
      0,
      ...action.cell.candidates,
    ].reduce((prev, cur) => prev | (1 << (cur - 1)));
    // bitmask, 7 bits for cell index, 4 bits for cell value, 9 bits for candiates
    return (isParentBit << 20) |
        (candidateMask << 11) |
        (action.cell.value << 7) |
        (action.cell.idx);
  }
}

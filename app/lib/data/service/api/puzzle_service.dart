import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:infinite_sudoku/domain/models/puzzle.dart';
import 'package:infinite_sudoku/utils/result.dart';

abstract class PuzzleService {
  Future<Result<Puzzle>> getNewPuzzle(DifficultyRating difficulty);
  Future<Result<Puzzle>> getPuzzle(String puzzleId);
  Future<Result<void>> saveProgress(Puzzle state);
}

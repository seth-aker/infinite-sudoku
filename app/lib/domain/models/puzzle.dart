import 'package:equatable/equatable.dart';
import 'package:infinite_sudoku/domain/models/action.dart';
import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:infinite_sudoku/domain/models/constants/puzzle_constants.dart';
import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:infinite_sudoku/data/model/puzzle/puzzle_dto.dart';
import 'package:infinite_sudoku/utils/serilization.dart';
import 'package:json_annotation/json_annotation.dart';

part 'puzzle.g.dart';

@JsonSerializable()
class Puzzle extends Equatable {
  final String puzzleId;

  final DifficultyRating rating;

  final int score;

  final List<Cell> cells;

  final List<Cell> originalCells;

  final List<Action> history;

  final List<Action> redoActions;

  final int elapsedSeconds;

  late final bool isComplete = _calculateIsComplete();

  Puzzle({
    required this.puzzleId,
    required this.rating,
    required this.score,
    required this.cells,
    required this.originalCells,
    required this.history,
    required this.elapsedSeconds,
    required this.redoActions,
  });

  Puzzle copyWith({
    List<Cell>? cells,
    List<Action>? history,
    List<Action>? redoActions,
    int? elapsedSeconds,
  }) {
    return Puzzle(
      puzzleId: puzzleId,
      rating: rating,
      score: score,
      cells: cells ?? this.cells,
      originalCells: originalCells,
      history: history ?? this.history,
      redoActions: redoActions ?? this.redoActions,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }

  factory Puzzle.fromNewPuzzleDto(NewPuzzleDTO dto) {
    final cells = PuzzleSerializer.deserializeCells(dto.cells, null);
    return Puzzle(
      puzzleId: dto.puzzleId,
      rating: dto.rating,
      score: dto.score,
      cells: cells,
      originalCells: [...cells],
      history: [],
      redoActions: [],
      elapsedSeconds: 0,
    );
  }

  factory Puzzle.fromUserPuzzleDto(UserPuzzleDTO dto) {
    final cells = PuzzleSerializer.deserializeCells(dto.cells, dto.candidates);
    final originalCells = PuzzleSerializer.deserializeCells(
      dto.originalCells,
      null,
    );
    final actions =
        dto.actions?.map(PuzzleSerializer.deserializeAction).toList() ??
        const <Action>[];

    return Puzzle(
      puzzleId: dto.puzzleId,
      rating: dto.rating,
      score: dto.score,
      cells: cells,
      originalCells: originalCells,
      history: actions,
      redoActions: [],
      elapsedSeconds: dto.time,
    );
  }

  factory Puzzle.fromJson(Map<String, dynamic> json) => _$PuzzleFromJson(json);

  Map<String, dynamic> toJson() => _$PuzzleToJson(this);


  bool _calculateIsComplete() {
    if(cells.length != 81) return false;
    if(cells.any((cell) => cell.value == 0)) return false;

    for(int i = 0; i < 81; i++) {
      final cell = cells[i];
      if(peers[i].any((peerIdx) => cells[peerIdx].value == cell.value)) {
        return false;
      }
    }
    return true;
  }
  @override
  List<Object?> get props => [
    puzzleId,
    rating,
    score,
    cells,
    originalCells,
    history,
    redoActions,
    elapsedSeconds,
  ];
}

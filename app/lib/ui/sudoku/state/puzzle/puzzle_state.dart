part of 'puzzle_bloc.dart';

sealed class PuzzleState extends Equatable {
  const PuzzleState();
  @override
  List<Object?> get props;
}

class PuzzleInitialState extends PuzzleState {
  const PuzzleInitialState();
  @override
  List<Object?> get props => [];
}

class PuzzlePlayingState extends PuzzleState {
  final String puzzleId;

  final DifficultyRating rating;

  final int score;

  final List<Cell> cells;

  final List<Cell> originalCells;

  final List<Action> history;

  final List<Action> redoActions;

  final int elapsedSeconds;

  final bool isCompleted;

  final int? selectedIdx;

  final bool usingPencil;

  final int moveCount;

  const PuzzlePlayingState({
    required this.puzzleId,
    required this.rating,
    required this.score,
    required this.cells,
    required this.originalCells,
    required this.history,
    required this.elapsedSeconds,
    this.redoActions = const [],
    this.isCompleted = false,
    this.usingPencil = false,
    this.selectedIdx,
    this.moveCount = 0,
  });
  PuzzlePlayingState copyWith({
    List<Cell>? cells,
    List<Action>? history,
    List<Action>? redoActions,
    bool? isCompleted,
    int? elapsedSeconds,
    int? selectedIdx,
    bool? usingPencil,
    int? moveCount,
  }) {
    return PuzzlePlayingState(
      puzzleId: puzzleId,
      rating: rating,
      score: score,
      cells: cells ?? this.cells,
      originalCells: originalCells,
      history: history ?? this.history,
      redoActions: redoActions ?? this.redoActions,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
      usingPencil: usingPencil ?? this.usingPencil,
      selectedIdx: selectedIdx ?? this.selectedIdx,
      moveCount: moveCount ?? this.moveCount,
    );
  }

  @override
  List<Object?> get props => [
    puzzleId,
    rating,
    originalCells,
    cells,
    score,
    history,
    elapsedSeconds,
    isCompleted,
    selectedIdx,
    usingPencil,
    moveCount,
  ];
}

class PuzzleLoadingState extends PuzzleState {
  const PuzzleLoadingState();
  @override
  List<Object?> get props => [];
}

class PuzzleErrorState extends PuzzleState {
  const PuzzleErrorState();
  @override
  List<Object?> get props => [];
}

import 'package:infinite_sudoku/data/repositories/puzzle_repository.dart';
import 'package:infinite_sudoku/domain/models/constants/puzzle_constants.dart';
import 'package:infinite_sudoku/domain/models/puzzle.dart';
import 'package:infinite_sudoku/ui/user/state/preferences_cubit.dart';
import 'package:infinite_sudoku/utils/result.dart';
import 'package:infinite_sudoku/domain/models/action.dart';
import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:equatable/equatable.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';

part 'puzzle_state.dart';
part 'puzzle_event.dart';

class PuzzleBloc extends HydratedBloc<PuzzleEvent, PuzzleState> {
  final PuzzleRepository _puzzleRepository;
  final PreferencesCubit _preferencesCubit;
  PuzzleBloc({required this._puzzleRepository, required this._preferencesCubit})
    : super(const PuzzleState(status: .initial)) {
    on<NewPuzzleFetched>(_onNewPuzzleFetched);
    on<PuzzleFetched>(_onPuzzleFetched);
    on<CellSelected>(_onCellSelected);
    on<PencilToggled>(_onPencilToggled);
    on<NumberPressed>(_onNumberPressed);
    on<UndoPressed>(_onUndoPressed);
    on<RedoPressed>(_onRedoPressed);
    on<AutoCandidateModeToggled>(_onAutoCandidateModeToggled);
    on<ResetBoardRequested>(_onResetBoardRequested);
    on<SavePuzzleRequested>(_onSavePuzzleRequested);
    on<PuzzleClearRequested>(_onPuzzleClearRequested);
  }

  Future<void> _onNewPuzzleFetched(
    NewPuzzleFetched event,
    Emitter<PuzzleState> emit,
  ) async {
    emit(state.copyWith(status: .loading));
    final difficulty = event.difficultyRating;
    final result = await _puzzleRepository.getNewPuzzle(difficulty);
    switch (result) {
      case Error<Puzzle>():
        emit(
          state.copyWith(status: .error, errorMessage: result.error.toString()),
        );
        return;
      case Ok<Puzzle>():
        final puzzle = result.value;
        final autoCandidateModeOn = _preferencesCubit.state.autoCandidateModeOn;
        emit(
          PuzzleState(
            status: .loaded,
            errorMessage: null,
            puzzle: autoCandidateModeOn
                ? puzzle.copyWith(cells: _fillPuzzleCandidates(puzzle.cells))
                : puzzle,
          ),
        );
    }
  }

  Future<void> _onPuzzleFetched(
    PuzzleFetched event,
    Emitter<PuzzleState> emit,
  ) async {
    emit(state.copyWith(status: .loading));
    final puzzleId = event.puzzleId;
    final result = await _puzzleRepository.getPuzzle(puzzleId);
    switch (result) {
      case Error<Puzzle>():
        emit(
          state.copyWith(status: .error, errorMessage: result.error.toString()),
        );
        return;
      case Ok<Puzzle>():
    }
    final puzzle = result.value;
    final autoCandidateModeOn = _preferencesCubit.state.autoCandidateModeOn;
    emit(
      PuzzleState(
        status: .loaded,
        puzzle: autoCandidateModeOn
            ? puzzle.copyWith(cells: _fillPuzzleCandidates(puzzle.cells))
            : puzzle,
      ),
    );
  }

  void _onCellSelected(CellSelected event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state.status == .loaded) {
      emit(state.copyWith(selectedIdx: event.selectedIdx));
    }
  }

  void _onPencilToggled(PencilToggled event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state.status == .loaded) {
      emit(state.copyWith(usingPencil: !state.usingPencil));
    }
  }

  void _onNumberPressed(NumberPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state.status != .loaded) return;

    final selectedIdx = state.selectedIdx;
    final value = event.value;
    if (value < 0 ||
        value > 9 ||
        selectedIdx == null ||
        selectedIdx < 0 ||
        selectedIdx > 80) {
      return;
    }

    if (state.puzzle?.originalCells[selectedIdx].value != 0) return;

    if (state.usingPencil) {
      _toggleCandidate(state, selectedIdx, value, emit);
    } else {
      _toggleValue(state, selectedIdx, value, emit);
    }
  }

  void _toggleValue(
    PuzzleState state,
    int idx,
    int value,
    Emitter<PuzzleState> emit,
  ) {
    final puzzle = state.puzzle;
    if (puzzle == null) return;

    final cells = List<Cell>.from(puzzle.cells);
    final originalCells = puzzle.originalCells;
    if (originalCells[idx].value != 0) {
      return;
    }
    final prevCell = cells[idx];
    final history = [...puzzle.history];
    history.add(Action(cell: prevCell, isParent: true));

    if (prevCell.value != value) {
      // Apply new value to target.
      cells[idx] = prevCell.copyWith(value: value, candidates: const {});
      // Loop through cell peers and remove candidates that equal new value;
      if (_preferencesCubit.state.autoCandidateModeOn) {
        final cellPeers = peers[idx];
        for (final peer in cellPeers) {
          final cell = cells[peer];
          if (cell.idx != idx && cell.candidates.contains(value)) {
            history.add(Action(cell: cell.copyWith(), isParent: false));
            cells[peer] = cell.copyWith(
              candidates: cell.candidates
                  .where((candidate) => candidate != value)
                  .toSet(),
            );
          }
        }
      }
    } else if (prevCell.value == value) {
      cells[idx] = prevCell.copyWith(value: 0);

      if (_preferencesCubit.state.autoCandidateModeOn) {
        final affectedCells = {idx, ...peers[idx]};
        for (final affectedIdx in affectedCells) {
          if (cells[affectedIdx].value != 0) continue;
          final candidates = <int>{};
          for (var c = 1; c <= 9; c++) {
            final cellPeers = peers[affectedIdx];
            if (cellPeers.any((peerIdx) => cells[peerIdx].value == c)) {
              candidates.remove(c);
            } else {
              candidates.add(c);
            }
          }
          history.add(Action(cell: cells[affectedIdx], isParent: false));
          cells[affectedIdx] = cells[affectedIdx].copyWith(
            candidates: candidates,
          );
        }
      }
    }
    emit(
      state.copyWith(
        cells: cells,
        history: history,
        redoActions: const [],
        moveCount: state.moveCount + 1,
      ),
    );
  }

  void _toggleCandidate(
    PuzzleState state,
    int idx,
    int value,
    Emitter<PuzzleState> emit,
  ) {
    final puzzle = state.puzzle;
    if (puzzle == null) return;
    if (puzzle.originalCells[idx].value != 0) {
      return;
    }
    final prevCell = puzzle.cells[idx];
    final candidates = Set<int>.from(prevCell.candidates);
    if (!candidates.contains(value)) {
      candidates.add(value);
    } else {
      candidates.remove(value);
    }
    final cells = List<Cell>.from(puzzle.cells);
    cells[idx] = prevCell.copyWith(candidates: candidates);
    emit(
      state.copyWith(
        cells: cells,
        history: [
          ...puzzle.history,
          Action(cell: prevCell, isParent: true),
        ],
        redoActions: const [],
        moveCount: state.moveCount + 1,
      ),
    );
  }

  void _onUndoPressed(UndoPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state.status == .loaded) {
      final puzzle = state.puzzle;
      if (puzzle == null) return;
      final redoActions = [...puzzle.redoActions];
      final cells = List<Cell>.from(puzzle.cells);
      final history = [...puzzle.history];
      var action = history.isNotEmpty ? history.removeLast() : null;
      int? selectedIdx = state.selectedIdx;
      // loop through each action that is not a parent action and add it to the redo stack
      // and then make the change to the cells array.
      while (action != null && !action.isParent) {
        final prevCell = cells[action.cell.idx];
        redoActions.add(Action(cell: prevCell, isParent: false));
        cells[action.cell.idx] = action.cell;
        action = history.isNotEmpty ? history.removeLast() : null;
      }
      // remove the parent action
      if (action != null) {
        final prevCell = cells[action.cell.idx];
        redoActions.add(Action(cell: prevCell, isParent: true));
        cells[action.cell.idx] = action.cell;
        selectedIdx = action.cell.idx;
      }
      emit(
        state.copyWith(
          cells: cells,
          history: history,
          redoActions: redoActions,
          selectedIdx: selectedIdx,
          moveCount: state.moveCount + 1,
        ),
      );
    }
  }

  void _onRedoPressed(RedoPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state.status == .loaded) {
      final puzzle = state.puzzle;
      if (puzzle == null) return;
      final cells = List<Cell>.from(puzzle.cells);
      final history = [...puzzle.history];
      final redoActions = [...puzzle.redoActions];
      var action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      int? selectedIdx = state.selectedIdx;

      if (action != null) {
        final prevCell = cells[action.cell.idx];
        cells[action.cell.idx] = action.cell;
        history.add(Action(cell: prevCell, isParent: true));

        selectedIdx = action.cell.idx;
        action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      }
      while (action != null && !action.isParent) {
        final prevCell = cells[action.cell.idx];
        cells[action.cell.idx] = action.cell;
        history.add(Action(cell: prevCell, isParent: false));
        action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      }
      if (action != null) {
        redoActions.add(action);
      }
      emit(
        state.copyWith(
          cells: cells,
          history: history,
          redoActions: redoActions,
          selectedIdx: selectedIdx,
          moveCount: state.moveCount + 1,
        ),
      );
    }
  }

  void _onAutoCandidateModeToggled(
    AutoCandidateModeToggled event,
    Emitter<PuzzleState> emit,
  ) {
    final state = this.state;
    final puzzle = state.puzzle;
    if (puzzle != null) {
      var cells = List<Cell>.from(puzzle.cells);
      // Intentionally doesn't change candiates when mode is toggled off.
      if (event.autoCandidateModeOn) {
        cells = _fillPuzzleCandidates(cells);
      }
      _preferencesCubit.setAutoCandidateMode(
        autoCandidateMode: event.autoCandidateModeOn,
      );
      emit(state.copyWith(cells: cells));
    }
  }

  void _onResetBoardRequested(
    ResetBoardRequested event,
    Emitter<PuzzleState> emit,
  ) {
    final puzzle = state.puzzle;
    if (puzzle != null && state.status == .loaded) {
      // TODO: add changes into undoActions
      emit(state.copyWith(cells: [...puzzle.originalCells], selectedIdx: null));
    }
  }

  // List<Cell> _generateEmptyCells() {
  //   final cells = <Cell>[];
  //   for (var i = 0; i < 81; i++) {
  //     cells.add(
  //       Cell(
  //         idx: i,
  //         value: i == 0 ? 9 : 0,
  //         candidates: {1, 2, 3, 4, 5, 6, 7, 8, 9},
  //       ),
  //     );
  //   }
  //   return cells;
  // }

  void _onSavePuzzleRequested(
    SavePuzzleRequested event,
    Emitter<PuzzleState> emit,
  ) async {
    final state = this.state;
    final puzzle = state.puzzle;
    if (state.status == .loaded && puzzle != null) {
      emit(state.copyWith(elapsedSeconds: event.elapsedSeconds));
      final result = await _puzzleRepository.saveProgress(puzzle);
      switch (result) {
        case Error():
          emit(
            state.copyWith(
              status: .error,
              errorMessage: result.error.toString(),
            ),
          );
        case Ok():
      }
    }
  }

  void _onPuzzleClearRequested(
    PuzzleClearRequested event,
    Emitter<PuzzleState> emit,
  ) async {
    emit(
      PuzzleState(status: .initial)
    );
  }

  List<Cell> _fillPuzzleCandidates(List<Cell> cells) {
    for (var i = 0; i < 81; i++) {
      if (cells[i].value != 0) continue;
      final candidates = <int>{};
      for (var c = 1; c <= 9; c++) {
        final cellPeers = peers[i];
        if (cellPeers.any((idx) => cells[idx].value == c)) {
          candidates.remove(c);
        } else {
          candidates.add(c);
        }
      }
      cells[i] = cells[i].copyWith(candidates: candidates);
    }
    return cells;
  }

  @override
  PuzzleState? fromJson(Map<String, dynamic> json) {
    try {
      return PuzzleState(
        status: PuzzleStatus.fromJson(json['status']),
        errorMessage: json['errorMessage'],
        puzzle: Puzzle.fromJson(json['puzzle']),
        selectedIdx: json['selectedIdx'],
        usingPencil: json['usingPencil'],
        moveCount: json['moveCount'],
      );
    } catch (e) {
      // TODO: Implement Error handling
      return null;
    }
  }

  @override
  Map<String, dynamic>? toJson(PuzzleState state) {
    try {
      return {
        'status': state.status.toString(),
        'errorMessage': state.errorMessage,
        'puzzle': state.puzzle?.toJson(),
        'selectedIdx': state.selectedIdx,
        'usingPencil': state.usingPencil,
        'moveCount': state.moveCount,
      };
    } catch (e) {
      return null;
    }
  }
}

import 'package:sudoku_app/domain/models/cell.dart';
import 'package:sudoku_app/domain/models/constants/puzzle_constants.dart';
import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/colors/app_colors.dart';
import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class CellWidget extends StatelessWidget {
  const CellWidget({super.key, required this.idx, required this.onTap});
  final int idx;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final cell = context.select<PuzzleBloc, Cell?>((bloc) {
      final state = bloc.state;
      return state is PuzzlePlayingState ? state.cells[idx] : null;
    });
    if (cell == null) return const SizedBox.shrink();
    final isSelected = context.select<PuzzleBloc, bool>((bloc) {
      final state = bloc.state;
      if (state is PuzzlePlayingState) {
        return state.selectedIdx == cell.idx;
      } else {
        return false;
      }
    });
    final isHighlighted = context.select<PuzzleBloc, bool>((bloc) {
      final state = bloc.state;
      if (state is PuzzlePlayingState) {
        return state.selectedIdx != null
            ? peers[state.selectedIdx!].contains(cell.idx)
            : false;
      } else {
        return false;
      }
    });
    final hasError = context.select<PuzzleBloc, bool>((bloc) {
      final state = bloc.state;
      if (state is PuzzlePlayingState) {
        return peers[cell.idx].any(
          (peer) => state.cells[peer].value == cell.value,
        );
      } else {
        return false;
      }
    });

    final puzzleBlocState = context.read<PuzzleBloc>().state;
    final isImmutable =
        puzzleBlocState is PuzzlePlayingState &&
        puzzleBlocState.originalCells[idx].value != 0;
    final visableCandidates = List.generate(
      9,
      (idx) => cell.value != 0 ? false : cell.candidates.contains(idx + 1),
    );

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primary()
              : isHighlighted
              ? AppColors.orange200
              : AppColors.white,
        ),
        child: cell.value != 0
            ? Center(
                child: Text(
                  cell.value.toString(),
                  style: TextStyle(
                    fontWeight: isImmutable
                        ? FontWeight.bold
                        : FontWeight.normal,
                    color: hasError ? AppTheme.destructive() : AppColors.black,
                  ),
                ),
              )
            : _CandidatesBox(visableCandidates),
      ),
    );
  }
}

class _CandidatesBox extends StatelessWidget {
  const _CandidatesBox(this.visableCandidates);

  final List<bool> visableCandidates;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _CandidateText(data: visableCandidates[0] ? '1' : ' '),
              _CandidateText(data: visableCandidates[1] ? '2' : ' '),
              _CandidateText(data: visableCandidates[2] ? '3' : ' '),
            ],
          ),
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _CandidateText(data: visableCandidates[3] ? '4' : ' '),
              _CandidateText(data: visableCandidates[4] ? '5' : ' '),
              _CandidateText(data: visableCandidates[5] ? '6' : ' '),
            ],
          ),
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _CandidateText(data: visableCandidates[6] ? '7' : ' '),
              _CandidateText(data: visableCandidates[7] ? '8' : ' '),
              _CandidateText(data: visableCandidates[8] ? '9' : ' '),
            ],
          ),
        ),
      ],
    );
  }
}

class _CandidateText extends StatelessWidget {
  final String data;
  const _CandidateText({required this.data});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsetsGeometry.all(AppSpacing.sixteenth),
        child: Center(
          child: FittedBox(fit: BoxFit.scaleDown, child: Text(data)),
        ),
      ),
    );
  }
}

import 'package:infinite_sudoku/domain/models/constants/puzzle_constants.dart';
import 'package:infinite_sudoku/ui/core/colors/app_colors.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/shimmer_provider.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:infinite_sudoku/ui/sudoku/widgets/puzzle/cell_widget.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class PuzzleWidget extends StatelessWidget {
  const PuzzleWidget({super.key});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsGeometry.all(AppSpacing.eighth),
      color: const Color.fromARGB(255, 177, 174, 170),
      child: Column(
        children: List.generate(
          3,
          (rowIdx) => Expanded(
            child: Row(
              children: List.generate(
                3,
                (colIdx) => Expanded(
                  child: Padding(
                    padding: const EdgeInsetsGeometry.all(AppSpacing.eighth),
                    child: _PuzzleBlock(blockIdx: rowIdx * 3 + colIdx),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PuzzleBlock extends StatelessWidget {
  const _PuzzleBlock({required this.blockIdx});
  final int blockIdx;
  @override
  Widget build(BuildContext context) {
    final isPlaying = context.select<PuzzleBloc, bool>(
      (bloc) => bloc.state.status == .loaded,
    );
    if (!isPlaying) return const SizedBox.shrink();

    final bloc = context.read<PuzzleBloc>();
    return GridView.count(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      crossAxisCount: 3,
      crossAxisSpacing: AppSpacing.sixteenth,
      mainAxisSpacing: AppSpacing.sixteenth,
      children: blockIdxs[blockIdx]
          .map(
            (cellIdx) => CellWidget(
              idx: cellIdx,
              onTap: () => bloc.add(CellSelected(selectedIdx: cellIdx)),
            ),
          )
          .toList(),
    );
  }
}

class PuzzleSkeleton extends StatelessWidget {
  const PuzzleSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerProvider(
      linearGradient: LinearGradient(
        colors: [
          AppColors.neutral300,
          AppColors.neutral200,
          AppColors.neutral300,
        ],
        stops: const [0.1, 0.3, 0.4],
        begin: const Alignment(-1.0, -0.1),
        end: const Alignment(1.0, 0),
      ),
      child: Container(
        padding: const EdgeInsetsGeometry.all(AppSpacing.eighth),
        color: const Color.fromARGB(255, 177, 174, 170),
        child: Column(
          children: List.generate(
            3,
            (rowIdx) => Expanded(
              child: Row(
                children: List.generate(
                  3,
                  (colIdx) => Expanded(
                    child: Padding(
                      padding: const EdgeInsetsGeometry.all(AppSpacing.eighth),
                      child: GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        crossAxisSpacing: AppSpacing.sixteenth,
                        mainAxisSpacing: AppSpacing.sixteenth,
                        children: List.generate(9, (_) => CellSkeleton()),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

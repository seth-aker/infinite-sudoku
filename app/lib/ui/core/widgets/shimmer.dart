import 'package:flutter/cupertino.dart';
import 'package:infinite_sudoku/ui/core/widgets/shimmer_provider.dart';

class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});
  final Widget child;
  @override
  State<StatefulWidget> createState() {
    return _ShimmerState();
  }
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  Listenable? _shimmerChanges;
 @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _shimmerChanges?.removeListener(_onShimmerChange);
    _shimmerChanges = ShimmerProvider.of(context)?.shimmerChanges;
    _shimmerChanges?.addListener(_onShimmerChange);
  }

  @override
  void dispose() {
    _shimmerChanges?.removeListener(_onShimmerChange);
    super.dispose();
  }

  void _onShimmerChange() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final shimmer = ShimmerProvider.of(context);
    final box = context.findRenderObject() as RenderBox?;

    // First frame: the Shimmer ancestor hasn't been laid out yet.
    // Keep layout but hide the raw (solid) skeleton to avoid a flash.
    if (shimmer == null || !shimmer.isSized || box == null || !box.hasSize) {
      return Opacity(opacity: 0, child: widget.child);
    }

    final shimmerSize = shimmer.size;
    final gradient = shimmer.gradient;
    final offset = shimmer.getDescendantOffset(descendant: box);

    return ShaderMask(
      blendMode: BlendMode.srcATop,
      shaderCallback: (bounds) {
        return gradient.createShader(
          Rect.fromLTWH(
            -offset.dx,
            -offset.dy,
            shimmerSize.width,
            shimmerSize.height,
          ),
        );
      },
      child: widget.child,
    );
  }
}

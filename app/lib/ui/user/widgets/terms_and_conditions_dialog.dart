import 'package:flutter/cupertino.dart';

void showTermsAndConditions<T>(
  BuildContext context,
  ScrollController scrollController,
) async {
  showCupertinoSheet<T>(
    context: context,
    scrollableBuilder: (context, scrollController) => _TermsAndConditions(),
  );
}

class _TermsAndConditions extends StatelessWidget {
  const _TermsAndConditions();

  @override
  Widget build(BuildContext context) {
    return const Text("Insert Terms and Conditions here...");
  }
}

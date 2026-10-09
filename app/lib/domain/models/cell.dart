import 'package:equatable/equatable.dart';

class Cell extends Equatable {
  final int idx;
  final int value;
  final Set<int> candidates;

  const Cell({
    required this.idx,
    required this.value,
    required this.candidates,
  });

  Cell copyWith({int? value, Set<int>? candidates}) => Cell(
    idx: idx,
    value: value ?? this.value,
    candidates: candidates ?? this.candidates,
  );

  @override
  List<Object?> get props => [idx, value, candidates];

  factory Cell.fromJson(Map<String, dynamic> json) {
    return Cell(
      idx: json['idx'] as int,
      value: json['value'] as int,
      candidates: Set<int>.from(json['candidates']),
    );
  }

  Map<String, dynamic> toJson() {
    return {'idx': idx, 'value': value, 'candidates': candidates.toList()};
  }
}

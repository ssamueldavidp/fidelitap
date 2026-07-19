import 'package:flutter/material.dart';

class LoyaltyCardWidget extends StatelessWidget {
  const LoyaltyCardWidget({
    super.key,
    required this.businessName,
    required this.cardName,
    required this.benefitDescription,
    required this.currentStamps,
    required this.stampsRequired,
    required this.stampIcon,
    required this.color,
    required this.bgMode,
    required this.status,
  });

  final String businessName;
  final String cardName;
  final String benefitDescription;
  final int currentStamps;
  final int stampsRequired;
  final String stampIcon;
  final Color color;
  final String bgMode;
  final String status;

  @override
  Widget build(BuildContext context) {
    final isDark = bgMode == 'dark';
    final bg = isDark ? const Color(0xFF0F172A) : Colors.white;
    final fg = isDark ? Colors.white : const Color(0xFF0F172A);
    final fgMuted = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final missing = stampsRequired - currentStamps;
    final isComplete = status == 'ready_to_claim' || status == 'claimed';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isComplete ? const Color(0xFFFBBF24) : color.withAlpha(80),
          width: isComplete ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withAlpha(30),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(businessName,
                  style: TextStyle(
                      color: color, fontSize: 12, fontWeight: FontWeight.w700,
                      letterSpacing: 1.2)),
              const Spacer(),
              if (isComplete)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFBBF24).withAlpha(30),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('¡PREMIO!',
                      style: TextStyle(
                          color: Color(0xFFFBBF24),
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ),
            ]),
            const SizedBox(height: 8),
            Text(cardName,
                style: TextStyle(
                    color: fg, fontSize: 20, fontWeight: FontWeight.w800)),
            Text(benefitDescription,
                style: TextStyle(color: fgMuted, fontSize: 13)),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(stampsRequired, (i) {
                final filled = i < currentStamps;
                return Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: filled ? color.withAlpha(30) : Colors.transparent,
                    border: Border.all(
                        color: filled ? color : fgMuted.withAlpha(80), width: 1.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      filled ? stampIcon : '',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 12),
            if (!isComplete)
              Text('$missing sello${missing == 1 ? '' : 's'} para tu premio',
                  style: TextStyle(color: fgMuted, fontSize: 13)),
            if (status == 'ready_to_claim')
              Text('¡Ve al negocio a reclamar tu premio! 🎉',
                  style: TextStyle(
                      color: const Color(0xFFFBBF24), fontSize: 13,
                      fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../data/mobile_api_client.dart';

Color _hexColor(String hex) {
  final h = hex.replaceAll('#', '');
  return Color(int.parse('FF$h', radix: 16));
}

class CardPreviewWidget extends StatelessWidget {
  final String name;
  final String stampIcon;
  final String color;
  final String bgType;
  final String bgValue;
  final String? bgImageUrl;
  final String? logoUrl;
  final bool multiRewards;
  final List<CardRewardModel> rewards;
  final int stampsRequired;
  final String benefitDescription;

  const CardPreviewWidget({
    super.key,
    required this.name,
    required this.stampIcon,
    required this.color,
    required this.bgType,
    required this.bgValue,
    this.bgImageUrl,
    this.logoUrl,
    required this.multiRewards,
    required this.rewards,
    required this.stampsRequired,
    required this.benefitDescription,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = _hexColor(color);
    final bgColor = _hexColor(bgValue);
    final sampleStamps = (stampsRequired * 0.6).ceil().clamp(1, stampsRequired);

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header row: name + logo/icon
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  name.isEmpty ? 'Nombre de tarjeta' : name,
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (logoUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    logoUrl!,
                    width: 36,
                    height: 36,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _iconPlaceholder(accentColor, stampIcon),
                  ),
                )
              else
                _iconPlaceholder(accentColor, stampIcon),
            ],
          ),
          const SizedBox(height: 16),
          // Stamp grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: stampsRequired.clamp(3, 8),
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemCount: stampsRequired,
            itemBuilder: (_, i) {
              final filled = i < sampleStamps;
              return Container(
                decoration: BoxDecoration(
                  color: filled
                      ? accentColor.withValues(alpha: 0.9)
                      : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: filled
                      ? null
                      : Border.all(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                ),
                child: Center(
                  child: Text(
                    stampIcon,
                    style: TextStyle(
                      fontSize: 14,
                      color: filled ? null : Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          // Reward progress bars
          if (multiRewards && rewards.isNotEmpty)
            ...rewards.map((r) => _RewardBar(reward: r, sampleStamps: sampleStamps))
          else
            _RewardBar(
              reward: CardRewardModel(
                id: '',
                stampsRequired: stampsRequired,
                rewardLabel: benefitDescription.isEmpty ? 'Premio' : benefitDescription,
                color: color,
                sortOrder: 0,
              ),
              sampleStamps: sampleStamps,
            ),
        ],
      ),
    );
  }

  Widget _iconPlaceholder(Color accentColor, String icon) => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: accentColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: accentColor.withValues(alpha: 0.3)),
        ),
        child: Center(child: Text(icon, style: const TextStyle(fontSize: 18))),
      );
}

class _RewardBar extends StatelessWidget {
  final CardRewardModel reward;
  final int sampleStamps;

  const _RewardBar({required this.reward, required this.sampleStamps});

  @override
  Widget build(BuildContext context) {
    final barColor = _hexColor(reward.color);
    final progress = (sampleStamps / reward.stampsRequired).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$sampleStamps/${reward.stampsRequired} sellos',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.5),
                  ),
                ),
                Text(
                  reward.rewardLabel,
                  style: TextStyle(
                    fontSize: 11,
                    color: barColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.white.withValues(alpha: 0.1),
                valueColor: AlwaysStoppedAnimation<Color>(barColor),
                minHeight: 4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

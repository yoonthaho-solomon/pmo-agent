# Data Contracts And Formulas

Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60

Final score = cosineSimilarityScore * 0.75 + h3SpatialScore * 0.25.

ETA, road distance, expected fare, and live pickup ETA are not part of final score.

22D order: score_dawn, score_morning, score_daytime, score_night, score_mon, score_tue, score_wed, score_thu, score_fri, score_sat, score_sun, score_short, score_medium, score_long, score_low_fare, score_mid_fare, score_high_fare, score_paid, score_free, score_surge, score_normal, score_near.

Driver preferred H3 is historical preference/behavior, not live GPS.

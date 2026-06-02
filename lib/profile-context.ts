/* ─── Candidate Profile Context ─── 
   Embedded from skills-matrix.md + projects-inventory.md
   Source of truth for /api/rank and /api/generate-resume
*/

export const SKILLS_MATRIX = `
## Verified Technical Stack — Gayoung Dan

### Languages
- Python (pandas, NumPy, matplotlib, scikit-learn, statsmodels)
- R (Shiny, ggplot2, fmsb, Leaflet, dplyr)
- SQL (PostgreSQL, MySQL 8.0+, Oracle)
- JavaScript (Vue.js — basic)

### Data Engineering & Big Data
- Apache Spark / PySpark (MLlib, Structured Streaming, RDD, DataFrame, SparkSQL)
- Apache Kafka (Producer, Consumer, kafka-python, kafka3)
- Docker
- FastAPI

### Analytics & BI
- Power BI, Tableau, Excel (advanced: pivot tables, Power Query, VLOOKUP)

### Databases
- PostgreSQL, MySQL, Oracle (basic)

### ML & Statistics
- Tree-based ensembles: Random Forest, XGBoost, Gradient Boosting (GBM)
- Clustering: K-means, hierarchical; K-Nearest Neighbours (K-NN)
- Feature engineering: lag-feature engineering for time-series
- scikit-learn (classification, regression), Spark MLlib (GBT, RF, Pipeline, CrossValidator, ParamGridBuilder)
- A/B testing, logistic regression, causal inference, uplift testing
- RMSE, AUC, F1, Odds Ratio, p-value interpretation

### Visualisation
- Power BI, Tableau, R Shiny + Leaflet, matplotlib, seaborn, D3.js (basic)

### Tools & Platforms
- Git/GitHub, Jupyter, VS Code, Google Colab, Railway, PostGIS

### Education
- Master of Data Science — Monash University (WAM 77.1/100, GPA 3.31/4.0)
- HD courses: Database Design, Data Visualisation, Data Wrangling, Foundations of Data Science, Applied Mathematics for ML
- Bachelor of Arts (Polish + Global Business & Technology) — HUFS (89.1/100)

### Skill Levels
| Skill | Level |
|---|---|
| SQL | Advanced |
| Python | Intermediate–Advanced |
| Power BI | Intermediate |
| Tableau | Intermediate |
| PySpark | Intermediate |
| R / R Shiny | Intermediate |
| Kafka | Basic–Intermediate |
| Docker | Basic |
`

export const PROJECTS_INVENTORY = `
## Project Portfolio — Gayoung Dan

1. Marketing Campaign Causal Evaluation | A/B Testing, Logistic Regression, Power BI (Jan 2026)
   - A/B testing + logistic regression on 41,188 records; 45% higher conversion odds (OR 1.45, p<0.001)
   - Power BI dashboard for causal findings

2. Digital Nomad Data Visualisation | Monash University (June 2025)
   - Multi-index scoring model, clustering, interactive dashboard (R Shiny, Leaflet, ggplot2)

3. Customer Segmentation & Market Strategy | Quantium — Data Analytics Job Simulation (Forage), self-completed (Feb 2025)
   - R-only retail transaction analysis (no SQL), uplift testing (2 of 3 trial stores significant, p<0.05), 7-segment reporting package, total sales $1,933,115
   - NOTE: Forage job simulation — never label as internship or paid/work experience

4. Stock Market Volatility Prediction | Kaggle, Monash University (Sep 2024)
   - Random forest time-series forecasting, 2nd place private leaderboard

5. Melbourne Transport Accessibility Analysis | SQL, PostGIS, Tableau, Spatial Data (Jan 2026)
   - SQL + PostGIS across 360 SA2 regions, 27,717 stops, 59,483 meshblocks; R²=0.88 vs 0.57 route coverage model
   - Weekday service intensity: inner-city peak ≈16,260 vs outer minimum 0.01 (NOT a ratio/multiplier)
   - NOTE: SQL & PostGIS capability is anchored to THIS project only

6. Distributed Property Market Analytics | Apache Spark, PySpark (Oct 2025)
   - 4.8M+ records, RDD vs DataFrame vs SparkSQL benchmarking

7. MelMoveNow — Data & API Backend | FastAPI, PostgreSQL (Dec 2025)
   - 9 API endpoints, cross-functional collaboration, real-time environmental filtering

8. Building Energy Consumption Prediction | PySpark, Spark MLlib (Sep 2025)
   - 1.4M+ readings, GBT model RMSLE 2.02, CrossValidator hyperparameter tuning

9. Near-Real-Time Energy Consumption Pipeline | Kafka, PySpark Streaming (Oct 2025)
   - Kafka → Spark Structured Streaming → GBT inference → Kafka sink

10. Accommodation Business Data Warehouse | SQL, Dimensional Modelling (Sep 2024)
    - Relational schema, ETL transformations
`

export const ROLE_SIGNALS = {
  DA: {
    primary: ['SQL', 'Power BI', 'Tableau', 'Excel', 'KPI', 'dashboard', 'reporting', 'stakeholder', 'business intelligence', 'data governance'],
    ats: ['SQL', 'PostGIS', 'Power BI', 'Tableau', 'Excel', 'Python', 'KPI', 'dashboard', 'reporting', 'data governance', 'data quality', 'stakeholder', 'cross-functional', 'business intelligence', 'data-driven', 'insights', 'performance tracking', 'pivot tables', 'Power Query', 'spatial analysis', 'geospatial data'],
  },
  DS: {
    primary: ['ML', 'model', 'Python', 'feature engineering', 'A/B testing', 'regression', 'classification', 'statistical analysis', 'predictive'],
    ats: ['machine learning', 'Python', 'scikit-learn', 'statistical modelling', 'A/B testing', 'hypothesis testing', 'regression', 'classification', 'feature engineering', 'model evaluation', 'RMSE', 'AUC', 'F1', 'causal inference', 'experimentation', 'predictive analytics', 'logistic regression', 'random forest', 'gradient boosting', 'pandas', 'NumPy', 'Jupyter'],
  },
  DE: {
    primary: ['ETL', 'ELT', 'Spark', 'Kafka', 'Airflow', 'cloud', 'streaming', 'Docker', 'data warehouse', 'pipeline'],
    ats: ['Apache Spark', 'PySpark', 'Kafka', 'ETL', 'ELT', 'data pipeline', 'data warehouse', 'streaming', 'batch processing', 'Docker', 'cloud', 'Airflow', 'orchestration', 'structured streaming', 'watermarking', 'Parquet', 'data lake', 'PostgreSQL', 'data architecture', 'scalability'],
  },
}

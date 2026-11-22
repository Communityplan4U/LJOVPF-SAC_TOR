# Approved SAC Terms of Reference assessment — November 22, 2026

**Evidence source:** `LJOVPF_SAC_TOR_Comparison_Approved_Weighted_Key_Findings_Updated.xlsx`, especially `Assessment Approval`, `Governance Areas` and `Governance Area Scores`. The approved comparisons are included verbatim as **data values** in [`../data/assessment.json`](../data/assessment.json), with the source-based summary wording, judgment, rationale, page/section citation and original approval-sheet row recorded separately for every item.

## Default governance-area ranking

| Rank | ID | Governance area | Weight | Components | Share per component |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | G1 | Community decision-making and influence | 30% | 2 | 15% |
| 2 | G2 | Timing and meaningful participation | 25% | 2 | 12.5% |
| 3 | G3 | Representation, equity and support | 20% | 2 | 10% |
| 4 | G5 | Transparency and public accountability | 15% | 3 | 5% |
| 5 | G4 | Committee governance and responsibilities | 10% | 3 | 3.333...% |

A participant's reordering **reassigns the weights by position**. It does not modify any of the written-TOR judgments.

## Approved comparative results

Positive numbers mean stronger written commitments in the comparator TOR than in the Little Jamaica and Oakwood Vaughan SAC TOR. The signed per-criterion ratings are +1 (comparator stronger), 0 (comparable) or −1 (LJOVPF stronger). The LJOVPF reference score is 0.

| Approved rank | Advisory body | Weighted net score (out of ±12) |
| ---: | --- | ---: |
| 1 | Jane Finch Initiative — Community Advisory Committee | +11.20 |
| 2 (tie) | Broadview Avenue Planning Study — Stakeholder Advisory Committee | +9.40 |
| 2 (tie) | Kingston Road Guildwood Planning Study — Local Advisory Committee | +9.40 |
| 4 | High Park Apartment Neighbourhood Character Study — Working Group | +8.60 |
| 5 | North York at the Centre — Local Advisory Committee | +6.00 |
| 6 | Picture Mount Dennis Study — Local Advisory Committee | +5.90 |
| 7 | Chinatown Tomorrow Planning Initiative — Community Working Group | +5.20 |
| 8 | Canada Square Special Study Area (Midtown) — Working Group | +4.90 |
| 9 | Toronto Seniors Strategy — Accountability Table | +4.80 |
| 10 | Weston in Gear Planning Study — Local Advisory Committee | +4.40 |
| 11 (reference) | Little Jamaica and Oakwood Vaughan — Stakeholder Advisory Committee | 0.00 |

The 120 approved criterion judgments comprise **78 comparator-stronger**, **26 comparable** and **16 LJOVPF-stronger** ratings. Each comparative judgment includes a recorded rationale and a source section; the public tool allows readers to explore all twelve criteria per comparator. A zero net score would not necessarily mean identical rules, because positive and negative criteria can offset.

## Formula

For each comparator, let `rᵢ` be its signed rating (+1, 0, −1) for each criterion, let `nₐ` be the number of criteria in governance area `a`, and let `wₐ` be its selected share (e.g. 0.30).

```
Total net score = 12 × Σ [ wₐ × (Σ rᵢ in area a / nₐ) ]
```

Governance area scores in the tool can also be displayed unweighted (simple signed sum) or weighted (that area's contribution to the 12-point total). All scores are deterministic functions of the approved values, not manually copied headline scores.

## Source and review notes

- The underlying TOR source citations are attached to each criterion judgment in [the assessment data](../data/assessment.json). Their evidence narratives are **summaries of TOR provisions**, not verbatim quotations.
- The **Weston in Gear LAC Terms of Reference** is a four-page City of Toronto document supplied for this project on November 22, 2026. It is available in the deployed site at [`../public/sources/weston-in-gear-lac-tor.pdf`](../public/sources/weston-in-gear-lac-tor.pdf) (SHA-256 `adbe8453c7b45993f8add14cd9be1676710caaa54085992880660b8e421186ea`). Its twelve judgments are approved in the workbook.
- The comparison evaluates **what the written TOR commits to**, not the performance of advisory bodies, whether staff honoured commitments, legal compliance, or community outcomes.
- The original approved workbook is the human review record. The canonical deployed machine-readable judgment file is `data/assessment.json`; if ratings change, reimport from the revised approved workbook and rerun validation and tests.

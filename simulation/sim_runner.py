"""Runs the attacker when someone presses Simulate on the frontend.

    python -m simulation.sim_runner     # leave running next to detection.live_detect

On startup it registers every scenario in simulation/scenarios.json (so the frontend can list them)
and aborts runs left over from a crash. Then it polls sim_run for "requested" rows; for each one it
runs simulation/attacker.py's run_scenario (same blast path as `python -m simulation.attacker`),
streaming its lines to the pipeline_log table. The detector picks the messages up on its own.
The frontend's request_simulation reducer already reset the previous run's state.
"""
import time

from detection.spacetime_client import call_reducer, query
from simulation.attacker import get_variants, load_scenarios, run_scenario, wave_sizes
from simulation.seed_spacetime import seed


def log(line):
    print(line)
    call_reducer("log_line", ["attacker", line])


def main():
    scenarios = load_scenarios()
    for s in scenarios.values():
        get_variants(s)  # make sure the Gemini cache exists before anyone presses Simulate
        call_reducer("register_scenario", [s["id"], s["label"], s["description"]])
    print(f"Registered scenarios: {', '.join(scenarios)}")

    for r in query("SELECT * FROM sim_run WHERE status = 'running'"):
        call_reducer("update_sim_run", [r["id"], "aborted"])

    print("Waiting for Simulate requests...")
    while True:
        for r in query("SELECT * FROM sim_run WHERE status = 'requested'"):
            run_id = r["id"]
            scenario_id = r["scenario_id"].strip('"')
            if scenario_id == "reset":  # Reset button: clear_residents + reseed the 5000 residents
                call_reducer("update_sim_run", [run_id, "running"])
                try:
                    log("↺ Reset: reseeding residents")
                    seed(log=log)
                    call_reducer("update_sim_run", [run_id, "done"])
                    log("↺ Reset complete: fresh city, ready to simulate")
                except (Exception, SystemExit) as e:  # seed_spacetime exits on HTTP errors
                    call_reducer("update_sim_run", [run_id, "aborted"])
                    log(f"✖ Reset failed: {e}")
                continue
            scenario = scenarios.get(scenario_id)
            if not scenario:
                call_reducer("update_sim_run", [run_id, "aborted"])
                continue
            call_reducer("update_sim_run", [run_id, "running"])
            log(f"▶ Run {run_id}: {scenario['label']} "
                f"(waves: {wave_sizes(scenario)}, every {scenario['interval_s']}s)")
            try:
                run_scenario(scenario, log=log)
                call_reducer("update_sim_run", [run_id, "done"])
                log(f"■ Run {run_id} finished")
            except Exception as e:
                call_reducer("update_sim_run", [run_id, "aborted"])
                log(f"✖ Run {run_id} failed: {e}")
        time.sleep(0.5)


if __name__ == "__main__":
    main()

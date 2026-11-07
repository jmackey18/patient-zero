import random

def generate_people(count: int) -> list[dict]:
    personas = ["Student", "Professional", "Grandparent"]
    '''
    the weakness values correspond to the personas' key
    to check if the persona gets infected, we get a random number 1-100
    if the random number is <= weakness value, the persona gets infected
    '''
    weakness_map = {"Student": 30, "Professional": 15, "Grandparent": 70}
    
    # Pre-sample the choices in bulk for massive speedup when count is large
    chosen_personas = random.choices(personas, k=count)
    
    return [
        {
            "name": f"Person {i}",
            "persona": persona,
            "weakness": weakness_map[persona]
        }
        for i, persona in enumerate(chosen_personas, start=1)
    ]

people_data = generate_people(5000)
print(f"Generated {len(people_data)} entries successfully.")
print(people_data[:5])  # Print the first 5 entries for verification
print("\n" + people_data[0]["persona"] + ", " + str(people_data[0]["weakness"]))
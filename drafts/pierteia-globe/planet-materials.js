import * as T from 'three';

// Orbital rendering is deliberately separate from the existing landmark lights.
// These are real-time approximations, not a spectral atmosphere/ocean simulation.
const vertex = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const output = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

export function createPlanetMaterials(textures) {
  const shared = {
    sunDirection: {value: new T.Vector3(-.5,.4,.75).normalize()},
    cloudRotation: {value: 0},
    cloudVisibility: {value: 1}
  };
  const ground = new T.ShaderMaterial({
    uniforms: {
      ...shared,
      albedoMap: {value: textures.color},
      normalMap: {value: textures.normal},
      landMap: {value: textures.land},
      weatherMap: {value: textures.cloud},
      roughnessMap: {value: textures.rough}
    },
    vertexShader: vertex,
    fragmentShader: /* glsl */`
      uniform sampler2D albedoMap, normalMap, landMap, weatherMap, roughnessMap;
      uniform vec3 sunDirection;
      uniform float cloudRotation, cloudVisibility;
      varying vec2 vUv;
      varying vec3 vWorld, vNormal;
      void main() {
        vec3 radial = normalize(vWorld);
        vec3 east = normalize(vec3(radial.z, 0.00001, -radial.x));
        vec3 north = normalize(cross(radial, east));
        vec3 tangentNormal = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        float land = texture2D(landMap, vUv).r;
        float polarFade = smoothstep(0.0, .16, length(radial.xz));
        vec3 N = normalize(radial * tangentNormal.z +
          (east * tangentNormal.x + north * tangentNormal.y) * land * .80 * polarFade);
        vec3 L = normalize(sunDirection);
        vec3 V = normalize(cameraPosition - vWorld);
        float sun = dot(radial,L);
        float lit = max(dot(N,L), 0.0);
        float daylight = smoothstep(-.12,.17,sun);
        vec3 base = texture2D(albedoMap,vUv).rgb;
        // Cloud shadow is sampled at the same moving longitude as the cloud shell.
        vec2 shadowUv = vUv - vec2(cloudRotation,0.0);
        shadowUv += vec2(dot(L,east),dot(L,north)) * .0018;
        float shadow = texture2D(weatherMap,shadowUv).a * cloudVisibility;
        vec3 illumination = vec3(.11,.15,.20) * (.06 + daylight*.23)
          + vec3(1.0,.975,.93) * lit * mix(1.7,1.06,land) * (1.0-shadow*.36);
        vec3 color = base * illumination;
        // Restrained glint only over water. No glossy skin on land or giant bulb.
        vec3 halfVector = normalize(L+V);
        float rough = texture2D(roughnessMap,vUv).g;
        float exponent = mix( 90.0,  40.0, rough);
        float glint = pow(max(dot(radial,halfVector),0.0),exponent);
        float fresnel = .025 + .25*pow(1.0-max(dot(radial,V),0.0),5.0);
        color += vec3(.75,.84,.90) * glint * fresnel * (1.0-land) * daylight * .26;
        // Aerial perspective near the limb; it is not a blue outline over the UI.
        float grazing = pow(1.0-max(dot(radial,V),0.0),3.4);
        vec3 air = vec3(.045,.18,.34);
        color = mix(color,air*max(sun*.7+.28,0.0),grazing*.60*daylight);
        float twilight = exp(-abs(sun)* 17.0) * grazing;
        color += vec3(.09,.052,.025)*twilight*.24;
        gl_FragColor = vec4(color,1.0);
        ${output}
      }
    `
  });

  function cloudMaterial(map, high = false) {
    return new T.ShaderMaterial({
      uniforms: {...shared, map: {value: map}, high: {value: high ? 1 : 0}},
      vertexShader: vertex,
      transparent: true,
      depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D map;
        uniform vec3 sunDirection;
        uniform float high;
        varying vec2 vUv;
        varying vec3 vWorld, vNormal;
        void main() {
          float density = texture2D(map,vUv).a;
          if(density<.007) discard;
          vec3 N=normalize(vWorld), L=normalize(sunDirection);
          vec3 E=normalize(vec3(N.z,.00001,-N.x));
          vec3 B=normalize(cross(N,E));
          float dx=texture2D(map,vUv+vec2(.0005,0.)).a-density;
          float dy=texture2D(map,vUv+vec2(0.,.0008)).a-density;
          vec3 cloudNormal=normalize(N-E*dx*2.0-B*dy*2.0);
          float sun=dot(N,L), day=smoothstep(-.12,.13,sun);
          float diffuse=max(dot(cloudNormal,L),0.);
          vec3 light=vec3(.003,.006,.013)+vec3(.15,.19,.24)*day
            +vec3(1.,.985,.955)*diffuse*.95;
          float selfShade=.88+.12*pow(density,.5);
          vec3 color=light*selfShade;
          float alpha=density*(high>.5?.52:.96);
          gl_FragColor=vec4(color,alpha);
          ${output}
        }
      `
    });
  }

  const air = new T.ShaderMaterial({
    uniforms: shared,
    vertexShader: vertex,
    side: T.BackSide,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    fragmentShader: /* glsl */`
      uniform vec3 sunDirection;
      varying vec3 vWorld, vNormal;
      void main() {
        vec3 N=normalize(vWorld), V=normalize(cameraPosition-vWorld);
        float rim=pow(1.0-abs(dot(N,V)),4.8);
        float sun=dot(N,normalize(sunDirection));
        float day=smoothstep(-.25,.55,sun);
        vec3 color=mix(vec3(.04,.07,.17),vec3(.10,.30,.60),day);
        gl_FragColor=vec4(color,rim*.42*day);
        ${output}
      }
    `
  });
  return {
    ground,
    lowCloud: cloudMaterial(textures.cloud),
    highCloud: cloudMaterial(textures.cirrus,true),
    air,
    update(sun, angle, visible) {
      shared.sunDirection.value.copy(sun).normalize();
      shared.cloudRotation.value = angle / (Math.PI * 2);
      shared.cloudVisibility.value = visible ? 1 : 0;
    }
  };
}
